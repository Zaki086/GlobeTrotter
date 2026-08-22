import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AUDIT_ACTION } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { toAmount } from '../utils/money';
import {
  addDays,
  diffInDays,
  inclusiveDayCount,
  isWithinRange,
  toDateString,
  toUtcDate,
} from '../utils/dates';
import type { RequestContext } from '../types';
import type {
  CreateStopInput,
  ReorderStopsInput,
  UpdateStopInput,
} from '../validators/stop.validator';
import { AuditService } from './audit.service';
import { EstimateService } from './estimate.service';
import { BudgetService } from './budget.service';
import { TripService } from './trip.service';

const stopInclude = {
  city: true,
  activities: {
    orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
    include: { activity: true },
  },
} satisfies Prisma.StopInclude;

type StopWithRelations = Prisma.StopGetPayload<{ include: typeof stopInclude }>;

export class StopService {
  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  static async create(
    tripId: string,
    userId: string,
    input: CreateStopInput,
    ctx: RequestContext = {},
  ) {
    await TripService.resolveAccess(tripId, userId, 'edit');

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { startDate: true, endDate: true },
    });

    const arrival = toUtcDate(input.arrivalDate);
    const departure = toUtcDate(input.departureDate);

    // A stop must sit inside its trip's window.
    if (
      !isWithinRange(arrival, trip.startDate, trip.endDate) ||
      !isWithinRange(departure, trip.startDate, trip.endDate)
    ) {
      throw ApiError.validation([
        {
          field: 'arrivalDate',
          message: `Stop dates must fall between ${toDateString(trip.startDate)} and ${toDateString(trip.endDate)}`,
        },
      ]);
    }

    const city = await prisma.city.findUnique({
      where: { id: input.cityId },
      select: { id: true, name: true },
    });
    if (!city) throw ApiError.badRequest('That city does not exist');

    const stop = await prisma.$transaction(async (tx) => {
      const count = await tx.stop.count({ where: { tripId } });
      const requested = input.sequence ?? count;
      // Clamp so a client cannot punch a hole in the sequence.
      const sequence = Math.min(Math.max(0, requested), count);

      // Shift later stops up to make room. The (tripId, sequence) unique index
      // means this must move them out of the way in descending order, which
      // updateMany cannot express — so free the slot with a temporary offset.
      if (sequence < count) {
        await tx.$executeRaw`
          UPDATE stops
          SET sequence = sequence + 1000000
          WHERE trip_id = ${tripId}::uuid AND sequence >= ${sequence}
        `;
        await tx.$executeRaw`
          UPDATE stops
          SET sequence = sequence - 999999
          WHERE trip_id = ${tripId}::uuid AND sequence >= 1000000
        `;
      }

      return tx.stop.create({
        data: {
          tripId,
          cityId: input.cityId,
          sequence,
          arrivalDate: arrival,
          departureDate: departure,
          notes: input.notes,
          accommodationCost: input.accommodationCost,
          transportCost: input.transportCost,
          mealsPerDayCost: input.mealsPerDayCost,
        },
        include: stopInclude,
      });
    });

    await BudgetService.recalculate(tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.STOP_CREATED,
      resourceType: 'stop',
      resourceId: stop.id,
      metadata: { tripId, city: city.name },
      ...ctx,
    });

    return this.toDto(stop);
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  static async listForTrip(tripId: string, userId: string) {
    await TripService.resolveAccess(tripId, userId, 'view');

    const stops = await prisma.stop.findMany({
      where: { tripId },
      orderBy: { sequence: 'asc' },
      include: stopInclude,
    });

    return stops.map((stop) => this.toDto(stop));
  }

  /** Resolves a stop id to its trip and checks the caller's access in one hop. */
  private static async loadStopForUser(
    stopId: string,
    userId: string,
    required: 'view' | 'edit',
  ) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, arrivalDate: true, departureDate: true, sequence: true },
    });
    if (!stop) throw ApiError.notFound('Stop not found');

    await TripService.resolveAccess(stop.tripId, userId, required);
    return stop;
  }

  static async getById(stopId: string, userId: string) {
    const found = await this.loadStopForUser(stopId, userId, 'view');
    const stop = await prisma.stop.findUniqueOrThrow({
      where: { id: found.id },
      include: stopInclude,
    });
    return this.toDto(stop);
  }

  // -------------------------------------------------------------------------
  // Update / delete
  // -------------------------------------------------------------------------

  static async update(
    stopId: string,
    userId: string,
    input: UpdateStopInput,
    ctx: RequestContext = {},
  ) {
    const existing = await this.loadStopForUser(stopId, userId, 'edit');

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: existing.tripId },
      select: { startDate: true, endDate: true },
    });

    const arrival = input.arrivalDate ? toUtcDate(input.arrivalDate) : existing.arrivalDate;
    const departure = input.departureDate ? toUtcDate(input.departureDate) : existing.departureDate;

    if (departure < arrival) {
      throw ApiError.validation([
        { field: 'departureDate', message: 'Departure date must be on or after the arrival date' },
      ]);
    }

    if (
      !isWithinRange(arrival, trip.startDate, trip.endDate) ||
      !isWithinRange(departure, trip.startDate, trip.endDate)
    ) {
      throw ApiError.validation([
        {
          field: 'arrivalDate',
          message: `Stop dates must fall between ${toDateString(trip.startDate)} and ${toDateString(trip.endDate)}`,
        },
      ]);
    }

    if (input.cityId) {
      const city = await prisma.city.findUnique({
        where: { id: input.cityId },
        select: { id: true },
      });
      if (!city) throw ApiError.badRequest('That city does not exist');
    }

    const stop = await prisma.stop.update({
      where: { id: stopId },
      data: {
        ...input,
        ...(input.arrivalDate ? { arrivalDate: arrival } : {}),
        ...(input.departureDate ? { departureDate: departure } : {}),
      },
      include: stopInclude,
    });

    // Scheduled activities that now fall outside the stop are unscheduled
    // rather than deleted, so the traveler keeps their picks.
    if (input.arrivalDate || input.departureDate) {
      await prisma.stopActivity.updateMany({
        where: {
          stopId,
          OR: [{ scheduledDate: { lt: arrival } }, { scheduledDate: { gt: departure } }],
        },
        data: { scheduledDate: null },
      });
    }

    await BudgetService.recalculate(existing.tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.STOP_UPDATED,
      resourceType: 'stop',
      resourceId: stopId,
      metadata: { tripId: existing.tripId, fields: Object.keys(input) },
      ...ctx,
    });

    return this.toDto(stop);
  }

  static async remove(stopId: string, userId: string, ctx: RequestContext = {}) {
    const existing = await this.loadStopForUser(stopId, userId, 'edit');

    await prisma.$transaction(async (tx) => {
      await tx.stop.delete({ where: { id: stopId } });
      // Close the gap so sequences stay dense (0..n-1).
      await tx.$executeRaw`
        UPDATE stops
        SET sequence = sequence - 1
        WHERE trip_id = ${existing.tripId}::uuid AND sequence > ${existing.sequence}
      `;
    });

    await BudgetService.recalculate(existing.tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.STOP_DELETED,
      resourceType: 'stop',
      resourceId: stopId,
      metadata: { tripId: existing.tripId },
      ...ctx,
    });
  }


  // -------------------------------------------------------------------------
  // Nights (dynamic date cascade)
  // -------------------------------------------------------------------------

  /**
   * Sets how many nights a stop lasts, and slides everything after it.
   *
   * This is what makes the itinerary feel live: change Jaipur from 2 nights to
   * 4 and the departure moves, every later stop shifts by the same two days,
   * and the trip end date grows to fit. Costs are then recomputed from the
   * destination's own rate band rather than left stale.
   *
   * Doing it server-side keeps one source of truth — the alternative is the
   * client issuing N separate stop updates, any of which could fail halfway
   * and leave the itinerary with overlapping dates.
   */
  static async setNights(
    stopId: string,
    userId: string,
    nights: number,
    ctx: RequestContext = {},
  ) {
    const target = await this.loadStopForUser(stopId, userId, 'edit');

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: target.tripId },
      select: { id: true, startDate: true, endDate: true, travelers: true },
    });

    const stops = await prisma.stop.findMany({
      where: { tripId: target.tripId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        cityId: true,
        sequence: true,
        arrivalDate: true,
        departureDate: true,
      },
    });

    const index = stops.findIndex((s) => s.id === stopId);
    if (index === -1) throw ApiError.notFound('Stop not found');

    // Re-flow every stop from the changed one onward, preserving each of the
    // later stops' own length.
    let cursor = toUtcDate(stops[index].arrivalDate);
    const updates: Array<{ id: string; arrivalDate: Date; departureDate: Date }> = [];

    for (let i = index; i < stops.length; i++) {
      const stop = stops[i];
      const stopNights =
        i === index ? Math.max(0, nights) : Math.max(0, diffInDays(stop.arrivalDate, stop.departureDate));

      const arrival = cursor;
      const departure = addDays(arrival, stopNights);
      updates.push({ id: stop.id, arrivalDate: arrival, departureDate: departure });

      // The next stop begins the day this one ends — same-day transfers.
      cursor = departure;
    }

    const newTripEnd = updates.length ? updates[updates.length - 1].departureDate : trip.endDate;

    await prisma.$transaction(async (tx) => {
      // Grow the trip window first, otherwise the stop updates would sit
      // outside it for a moment and any concurrent read would look wrong.
      if (newTripEnd > toUtcDate(trip.endDate)) {
        await tx.trip.update({ where: { id: trip.id }, data: { endDate: newTripEnd } });
      }

      for (const update of updates) {
        await tx.stop.update({
          where: { id: update.id },
          data: { arrivalDate: update.arrivalDate, departureDate: update.departureDate },
        });
      }
    });

    // A shifted stop can strand its activities on days it no longer covers.
    await this.unscheduleOutOfRangeActivities(target.tripId);

    // Re-price the changed stop against its new length.
    await this.repriceStop(stopId, trip.travelers);

    await BudgetService.recalculate(target.tripId);

    AuditService.queue({
      actorId: userId,
      action: 'stop.nights_changed',
      resourceType: 'stop',
      resourceId: stopId,
      metadata: { tripId: target.tripId, nights, shiftedStops: updates.length - 1 },
      ...ctx,
    });

    return this.listForTrip(target.tripId, userId);
  }

  /**
   * Recomputes a stop's stay and meal figures from the city's rate band.
   *
   * Only touches costs the traveller has not overridden: a zero means "not set
   * yet", so we fill it; a non-zero value is theirs and is left alone.
   */
  private static async repriceStop(stopId: string, travelers: number) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        cityId: true,
        arrivalDate: true,
        departureDate: true,
        accommodationCost: true,
        mealsPerDayCost: true,
      },
    });
    if (!stop) return;

    const estimate = await EstimateService.estimateStop({
      cityId: stop.cityId,
      arrivalDate: toDateString(stop.arrivalDate),
      departureDate: toDateString(stop.departureDate),
      travelers,
    });

    await prisma.stop.update({
      where: { id: stop.id },
      data: {
        accommodationCost: estimate.suggested.accommodationCost,
        mealsPerDayCost: Number(stop.mealsPerDayCost) > 0
          ? stop.mealsPerDayCost
          : estimate.suggested.mealsPerDayCost,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Reorder (drag & drop)
  // -------------------------------------------------------------------------

  /**
   * Applies a new stop order for a trip.
   *
   * The client sends the complete ordered id list; anything else is rejected,
   * which makes the operation idempotent and prevents a stale drag from
   * silently dropping a stop. `(trip_id, sequence)` is unique, so the write
   * happens in two passes — park everything above the collision range, then
   * settle into the final positions.
   */
  static async reorder(userId: string, input: ReorderStopsInput, ctx: RequestContext = {}) {
    await TripService.resolveAccess(input.tripId, userId, 'edit');

    const stops = await prisma.stop.findMany({
      where: { tripId: input.tripId },
      orderBy: { sequence: 'asc' },
      select: { id: true, arrivalDate: true, departureDate: true },
    });

    if (stops.length !== input.stopIds.length) {
      throw ApiError.badRequest(
        `Expected all ${stops.length} stop ids for this trip, received ${input.stopIds.length}`,
      );
    }

    const known = new Set(stops.map((s) => s.id));
    const unknown = input.stopIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw ApiError.badRequest('One or more stop ids do not belong to this trip');
    }

    // Optionally re-flow the dates so the new order stays chronological,
    // preserving each stop's length and the gaps between them.
    const byId = new Map(stops.map((s) => [s.id, s]));
    const durations = input.stopIds.map((id) => {
      const stop = byId.get(id)!;
      return inclusiveDayCount(stop.arrivalDate, stop.departureDate);
    });

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: input.tripId },
      select: { startDate: true },
    });

    await prisma.$transaction(async (tx) => {
      // Pass 1 — move every row far out of the way so no two rows collide.
      await tx.$executeRaw`
        UPDATE stops SET sequence = sequence + 1000000 WHERE trip_id = ${input.tripId}::uuid
      `;

      // Pass 2 — settle into final order (and dates, when requested).
      let cursor = toUtcDate(trip.startDate);

      for (const [index, id] of input.stopIds.entries()) {
        const data: Prisma.StopUpdateInput = { sequence: index };

        if (input.shiftDates) {
          const nights = durations[index] - 1;
          data.arrivalDate = cursor;
          data.departureDate = addDays(cursor, nights);
          // Next stop begins the day this one ends (same-day transfers).
          cursor = addDays(cursor, nights);
        }

        await tx.stop.update({ where: { id }, data });
      }
    });

    if (input.shiftDates) {
      // Re-flowing may have pushed activities off their stop's days.
      await this.unscheduleOutOfRangeActivities(input.tripId);
    }

    await BudgetService.recalculate(input.tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.STOP_REORDERED,
      resourceType: 'trip',
      resourceId: input.tripId,
      metadata: { order: input.stopIds, shiftDates: input.shiftDates },
      ...ctx,
    });

    return this.listForTrip(input.tripId, userId);
  }

  private static async unscheduleOutOfRangeActivities(tripId: string) {
    const stops = await prisma.stop.findMany({
      where: { tripId },
      select: { id: true, arrivalDate: true, departureDate: true },
    });

    await Promise.all(
      stops.map((stop) =>
        prisma.stopActivity.updateMany({
          where: {
            stopId: stop.id,
            OR: [
              { scheduledDate: { lt: stop.arrivalDate } },
              { scheduledDate: { gt: stop.departureDate } },
            ],
          },
          data: { scheduledDate: null },
        }),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  static toDto(stop: StopWithRelations) {
    return {
      id: stop.id,
      tripId: stop.tripId,
      sequence: stop.sequence,
      arrivalDate: toDateString(stop.arrivalDate),
      departureDate: toDateString(stop.departureDate),
      days: inclusiveDayCount(stop.arrivalDate, stop.departureDate),
      nights: Math.max(0, diffInDays(stop.arrivalDate, stop.departureDate)),
      notes: stop.notes,
      accommodationCost: toAmount(stop.accommodationCost),
      transportCost: toAmount(stop.transportCost),
      mealsPerDayCost: toAmount(stop.mealsPerDayCost),
      city: {
        id: stop.city.id,
        name: stop.city.name,
        country: stop.city.country,
        countryCode: stop.city.countryCode,
        region: stop.city.region,
        timezone: stop.city.timezone,
        latitude: Number(stop.city.latitude),
        longitude: Number(stop.city.longitude),
        costIndex: stop.city.costIndex,
        imageUrl: stop.city.imageUrl,
      },
      activities: stop.activities.map((sa) => ({
        id: sa.id,
        activityId: sa.activityId,
        name: sa.activity.name,
        type: sa.activity.type,
        description: sa.activity.description,
        imageUrl: sa.activity.imageUrl,
        scheduledDate: sa.scheduledDate ? toDateString(sa.scheduledDate) : null,
        startTime: sa.startTime,
        endTime: sa.endTime,
        sequence: sa.sequence,
        cost: toAmount(sa.costOverride ?? sa.activity.estimatedCost),
        currency: sa.activity.currency,
        durationMinutes: sa.durationOverride ?? sa.activity.durationMinutes,
        notes: sa.notes,
      })),
      createdAt: stop.createdAt,
      updatedAt: stop.updatedAt,
    };
  }
}

export default StopService;
