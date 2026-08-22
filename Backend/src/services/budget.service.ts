import { ExpenseCategory, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AUDIT_ACTION } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { divide, percentage, sum, toAmount, toDecimal } from '../utils/money';
import { enumerateDates, inclusiveDayCount, toDateString, toUtcDate } from '../utils/dates';
import type { RequestContext } from '../types';
import type { CreateExpenseInput, UpdateBudgetInput } from '../validators/budget.validator';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { TripService } from './trip.service';

export interface BudgetBreakdown {
  transport: number;
  stay: number;
  meals: number;
  activities: number;
  other: number;
}

export interface DailyBudgetEntry {
  date: string;
  dayNumber: number;
  city: string | null;
  transport: number;
  stay: number;
  meals: number;
  activities: number;
  other: number;
  total: number;
  isOverBudget: boolean;
}

/**
 * The budget engine.
 *
 * Two sources of money are combined:
 *   1. Itinerary-derived estimates — per-stop accommodation/transport/meals
 *      and the cost of each scheduled activity. These update automatically
 *      whenever the itinerary changes.
 *   2. Manually logged expenses, which the traveler records as actuals.
 *
 * `recalculate()` is the single writer of the budgets rollup table and is
 * called after every mutation that can move a number.
 */
export class BudgetService {
  // -------------------------------------------------------------------------
  // Recalculation
  // -------------------------------------------------------------------------

  static async recalculate(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        travelers: true,
        currency: true,
        budget: { select: { id: true, plannedTotal: true, dailyLimit: true } },
        stops: {
          select: {
            id: true,
            arrivalDate: true,
            departureDate: true,
            accommodationCost: true,
            transportCost: true,
            mealsPerDayCost: true,
            activities: {
              select: {
                costOverride: true,
                activity: { select: { estimatedCost: true } },
              },
            },
          },
        },
        expenses: { select: { category: true, amount: true } },
      },
    });

    if (!trip) throw ApiError.notFound('Trip not found');

    let transport = new Prisma.Decimal(0);
    let stay = new Prisma.Decimal(0);
    let meals = new Prisma.Decimal(0);
    let activities = new Prisma.Decimal(0);
    let other = new Prisma.Decimal(0);

    for (const stop of trip.stops) {
      transport = transport.add(toDecimal(stop.transportCost));
      stay = stay.add(toDecimal(stop.accommodationCost));

      // Meals are quoted per person per day, so scale by nights and party size.
      const days = inclusiveDayCount(stop.arrivalDate, stop.departureDate);
      meals = meals.add(toDecimal(stop.mealsPerDayCost).mul(days).mul(trip.travelers));

      for (const sa of stop.activities) {
        // Activity prices are per person.
        const unit = toDecimal(sa.costOverride ?? sa.activity.estimatedCost);
        activities = activities.add(unit.mul(trip.travelers));
      }
    }

    // Logged expenses are absolute amounts, already covering the whole party.
    for (const expense of trip.expenses) {
      const amount = toDecimal(expense.amount);
      switch (expense.category) {
        case ExpenseCategory.TRANSPORT:
          transport = transport.add(amount);
          break;
        case ExpenseCategory.STAY:
          stay = stay.add(amount);
          break;
        case ExpenseCategory.MEALS:
          meals = meals.add(amount);
          break;
        case ExpenseCategory.ACTIVITIES:
          activities = activities.add(amount);
          break;
        default:
          other = other.add(amount);
      }
    }

    const grandTotal = sum(transport, stay, meals, activities, other);
    const totalDays = inclusiveDayCount(trip.startDate, trip.endDate);
    const perDayAverage = divide(grandTotal, totalDays);

    const budget = await prisma.budget.upsert({
      where: { tripId },
      create: {
        tripId,
        currency: trip.currency,
        transportTotal: transport,
        stayTotal: stay,
        mealsTotal: meals,
        activitiesTotal: activities,
        otherTotal: other,
        grandTotal,
        perDayAverage,
        lastCalculatedAt: new Date(),
      },
      update: {
        currency: trip.currency,
        transportTotal: transport,
        stayTotal: stay,
        mealsTotal: meals,
        activitiesTotal: activities,
        otherTotal: other,
        grandTotal,
        perDayAverage,
        lastCalculatedAt: new Date(),
      },
    });

    await this.notifyIfOverBudget(tripId, budget.plannedTotal, grandTotal);
    await TripService.invalidateForMembers(tripId);

    return budget;
  }

  /** One alert per crossing, not one per edit — checked against the prior total. */
  private static async notifyIfOverBudget(
    tripId: string,
    plannedTotal: Prisma.Decimal | null,
    grandTotal: Prisma.Decimal,
  ) {
    if (!plannedTotal || plannedTotal.isZero() || grandTotal.lte(plannedTotal)) return;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { name: true, ownerId: true, currency: true },
    });
    if (!trip) return;

    NotificationService.queue({
      userId: trip.ownerId,
      type: 'BUDGET_ALERT',
      title: `"${trip.name}" is over budget`,
      body: `Estimated ${toAmount(grandTotal)} ${trip.currency} against a planned ${toAmount(plannedTotal)} ${trip.currency}.`,
      data: { tripId, grandTotal: toAmount(grandTotal), plannedTotal: toAmount(plannedTotal) },
    });
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  static async getBudget(tripId: string, userId: string) {
    await TripService.resolveAccess(tripId, userId, 'view');

    // Always recompute on read so the figures can never be stale, even if a
    // write path was added later that forgot to call recalculate().
    await this.recalculate(tripId);

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        travelers: true,
        currency: true,
        budget: true,
        stops: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            arrivalDate: true,
            departureDate: true,
            accommodationCost: true,
            transportCost: true,
            mealsPerDayCost: true,
            city: { select: { name: true, country: true } },
            activities: {
              select: {
                scheduledDate: true,
                costOverride: true,
                activity: { select: { name: true, estimatedCost: true } },
              },
            },
          },
        },
        expenses: {
          select: { category: true, amount: true, incurredOn: true, title: true },
        },
      },
    });

    const budget = trip.budget!;
    const totalDays = inclusiveDayCount(trip.startDate, trip.endDate);
    const grandTotal = toDecimal(budget.grandTotal);

    const daily = this.buildDailyBreakdown(trip, budget.dailyLimit);
    const overBudgetDays = daily.filter((d) => d.isOverBudget);

    const breakdown: BudgetBreakdown = {
      transport: toAmount(budget.transportTotal),
      stay: toAmount(budget.stayTotal),
      meals: toAmount(budget.mealsTotal),
      activities: toAmount(budget.activitiesTotal),
      other: toAmount(budget.otherTotal),
    };

    const plannedTotal = budget.plannedTotal ? toAmount(budget.plannedTotal) : null;

    return {
      tripId: trip.id,
      tripName: trip.name,
      currency: budget.currency,
      travelers: trip.travelers,
      totalDays,

      total: toAmount(grandTotal),
      plannedTotal,
      remaining: plannedTotal === null ? null : Number((plannedTotal - toAmount(grandTotal)).toFixed(2)),
      isOverBudget: plannedTotal !== null && toAmount(grandTotal) > plannedTotal,

      breakdown,
      // Ready-to-render slices for the pie/bar chart in the PRD.
      breakdownPercentage: {
        transport: percentage(budget.transportTotal, grandTotal),
        stay: percentage(budget.stayTotal, grandTotal),
        meals: percentage(budget.mealsTotal, grandTotal),
        activities: percentage(budget.activitiesTotal, grandTotal),
        other: percentage(budget.otherTotal, grandTotal),
      },

      perDayAverage: toAmount(budget.perDayAverage),
      perPersonTotal: toAmount(divide(grandTotal, trip.travelers)),
      dailyLimit: budget.dailyLimit ? toAmount(budget.dailyLimit) : null,

      daily,
      overBudgetDays: overBudgetDays.map((d) => ({
        date: d.date,
        total: d.total,
        overBy: budget.dailyLimit
          ? Number((d.total - toAmount(budget.dailyLimit)).toFixed(2))
          : 0,
      })),
      overBudgetDayCount: overBudgetDays.length,

      byStop: trip.stops.map((stop) => {
        const days = inclusiveDayCount(stop.arrivalDate, stop.departureDate);
        const activityTotal = stop.activities.reduce(
          (acc, sa) => acc.add(toDecimal(sa.costOverride ?? sa.activity.estimatedCost).mul(trip.travelers)),
          new Prisma.Decimal(0),
        );
        const mealsTotal = toDecimal(stop.mealsPerDayCost).mul(days).mul(trip.travelers);
        return {
          stopId: stop.id,
          city: stop.city.name,
          country: stop.city.country,
          days,
          transport: toAmount(stop.transportCost),
          stay: toAmount(stop.accommodationCost),
          meals: toAmount(mealsTotal),
          activities: toAmount(activityTotal),
          total: toAmount(sum(stop.transportCost, stop.accommodationCost, mealsTotal, activityTotal)),
        };
      }),

      lastCalculatedAt: budget.lastCalculatedAt,
    };
  }

  /**
   * Spreads costs across calendar days so the UI can flag overbudget days.
   * Lodging and transport are amortised over the nights of their stop rather
   * than dumped on the arrival date, which would create false spikes.
   */
  private static buildDailyBreakdown(
    trip: {
      startDate: Date;
      endDate: Date;
      travelers: number;
      stops: Array<{
        arrivalDate: Date;
        departureDate: Date;
        accommodationCost: Prisma.Decimal;
        transportCost: Prisma.Decimal;
        mealsPerDayCost: Prisma.Decimal;
        city: { name: string };
        activities: Array<{
          scheduledDate: Date | null;
          costOverride: Prisma.Decimal | null;
          activity: { estimatedCost: Prisma.Decimal };
        }>;
      }>;
      expenses: Array<{ category: ExpenseCategory; amount: Prisma.Decimal; incurredOn: Date }>;
    },
    dailyLimit: Prisma.Decimal | null,
  ): DailyBudgetEntry[] {
    const dates = enumerateDates(trip.startDate, trip.endDate);

    const buckets = new Map<string, DailyBudgetEntry>(
      dates.map((date, index) => [
        date,
        {
          date,
          dayNumber: index + 1,
          city: null,
          transport: 0,
          stay: 0,
          meals: 0,
          activities: 0,
          other: 0,
          total: 0,
          isOverBudget: false,
        },
      ]),
    );

    for (const stop of trip.stops) {
      const stopDates = enumerateDates(stop.arrivalDate, stop.departureDate).filter((d) =>
        buckets.has(d),
      );
      if (stopDates.length === 0) continue;

      const perDayStay = toDecimal(stop.accommodationCost).div(stopDates.length);
      const perDayMeals = toDecimal(stop.mealsPerDayCost).mul(trip.travelers);

      stopDates.forEach((date, index) => {
        const bucket = buckets.get(date)!;
        bucket.city ??= stop.city.name;
        bucket.stay = Number((bucket.stay + toAmount(perDayStay)).toFixed(2));
        bucket.meals = Number((bucket.meals + toAmount(perDayMeals)).toFixed(2));
        // Travel to the stop happens on its first day.
        if (index === 0) {
          bucket.transport = Number((bucket.transport + toAmount(stop.transportCost)).toFixed(2));
        }
      });

      for (const sa of stop.activities) {
        const cost = toAmount(toDecimal(sa.costOverride ?? sa.activity.estimatedCost).mul(trip.travelers));
        // Unscheduled activities land on the stop's first day.
        const key = sa.scheduledDate ? toDateString(sa.scheduledDate) : stopDates[0];
        const bucket = buckets.get(key) ?? buckets.get(stopDates[0]);
        if (bucket) bucket.activities = Number((bucket.activities + cost).toFixed(2));
      }
    }

    for (const expense of trip.expenses) {
      const bucket = buckets.get(toDateString(expense.incurredOn));
      if (!bucket) continue;
      const amount = toAmount(expense.amount);
      switch (expense.category) {
        case ExpenseCategory.TRANSPORT:
          bucket.transport = Number((bucket.transport + amount).toFixed(2));
          break;
        case ExpenseCategory.STAY:
          bucket.stay = Number((bucket.stay + amount).toFixed(2));
          break;
        case ExpenseCategory.MEALS:
          bucket.meals = Number((bucket.meals + amount).toFixed(2));
          break;
        case ExpenseCategory.ACTIVITIES:
          bucket.activities = Number((bucket.activities + amount).toFixed(2));
          break;
        default:
          bucket.other = Number((bucket.other + amount).toFixed(2));
      }
    }

    const limit = dailyLimit ? toAmount(dailyLimit) : null;

    return [...buckets.values()].map((bucket) => {
      const total = Number(
        (bucket.transport + bucket.stay + bucket.meals + bucket.activities + bucket.other).toFixed(2),
      );
      return { ...bucket, total, isOverBudget: limit !== null && total > limit };
    });
  }

  // -------------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------------

  static async updateBudget(
    tripId: string,
    userId: string,
    input: UpdateBudgetInput,
    ctx: RequestContext = {},
  ) {
    await TripService.resolveAccess(tripId, userId, 'edit');

    await prisma.budget.upsert({
      where: { tripId },
      create: {
        tripId,
        plannedTotal: input.plannedTotal ?? null,
        dailyLimit: input.dailyLimit ?? null,
        currency: input.currency ?? 'USD',
      },
      update: {
        ...(input.plannedTotal !== undefined ? { plannedTotal: input.plannedTotal } : {}),
        ...(input.dailyLimit !== undefined ? { dailyLimit: input.dailyLimit } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
      },
    });

    await this.recalculate(tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.BUDGET_UPDATED,
      resourceType: 'budget',
      resourceId: tripId,
      metadata: { fields: Object.keys(input) },
      ...ctx,
    });

    return this.getBudget(tripId, userId);
  }

  static async addExpense(
    tripId: string,
    userId: string,
    input: CreateExpenseInput,
    ctx: RequestContext = {},
  ) {
    await TripService.resolveAccess(tripId, userId, 'edit');

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { currency: true, startDate: true, endDate: true },
    });

    if (input.stopId) {
      const stop = await prisma.stop.findFirst({
        where: { id: input.stopId, tripId },
        select: { id: true },
      });
      if (!stop) throw ApiError.badRequest('That stop does not belong to this trip');
    }

    const expense = await prisma.expense.create({
      data: {
        tripId,
        stopId: input.stopId ?? null,
        createdById: userId,
        category: input.category,
        title: input.title,
        amount: input.amount,
        currency: input.currency ?? trip.currency,
        incurredOn: toUtcDate(input.incurredOn),
        notes: input.notes,
      },
    });

    await this.recalculate(tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.EXPENSE_CREATED,
      resourceType: 'expense',
      resourceId: expense.id,
      metadata: { tripId, category: expense.category },
      ...ctx,
    });

    return {
      ...expense,
      amount: toAmount(expense.amount),
      incurredOn: toDateString(expense.incurredOn),
    };
  }

  static async listExpenses(
    tripId: string,
    userId: string,
    params: {
      skip: number;
      take: number;
      category?: ExpenseCategory;
      stopId?: string;
      from?: string;
      to?: string;
    },
  ) {
    await TripService.resolveAccess(tripId, userId, 'view');

    const where: Prisma.ExpenseWhereInput = { tripId };
    if (params.category) where.category = params.category;
    if (params.stopId) where.stopId = params.stopId;
    if (params.from || params.to) {
      where.incurredOn = {
        ...(params.from ? { gte: toUtcDate(params.from) } : {}),
        ...(params.to ? { lte: toUtcDate(params.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { incurredOn: 'desc' },
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        ...e,
        amount: toAmount(e.amount),
        incurredOn: toDateString(e.incurredOn),
      })),
      total,
    };
  }

  static async removeExpense(
    tripId: string,
    userId: string,
    expenseId: string,
    ctx: RequestContext = {},
  ) {
    await TripService.resolveAccess(tripId, userId, 'edit');

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, tripId },
      select: { id: true },
    });
    if (!expense) throw ApiError.notFound('Expense not found');

    await prisma.expense.delete({ where: { id: expense.id } });
    await this.recalculate(tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.EXPENSE_DELETED,
      resourceType: 'expense',
      resourceId: expenseId,
      metadata: { tripId },
      ...ctx,
    });
  }
}

export default BudgetService;
