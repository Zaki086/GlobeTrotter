import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, AUDIT_ACTION, CACHE_TTL } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { toAmount } from '../utils/money';
import { isWithinRange, toDateString, toUtcDate } from '../utils/dates';
import { stableHash } from '../utils/hash';
import type { RequestContext } from '../types';
import type {
  AddStopActivityInput,
  ListActivitiesQuery,
} from '../validators/activity.validator';
import { AuditService } from './audit.service';
import { BudgetService } from './budget.service';
import { TripService } from './trip.service';

export class ActivityService {
  // -------------------------------------------------------------------------
  // Catalog search
  // -------------------------------------------------------------------------

  static async search(query: ListActivitiesQuery) {
    const cacheKey = CACHE_KEY.activitySearch(stableHash(query));
    const cached = await cache.get<{ items: unknown[]; total: number }>(cacheKey);
    if (cached) return cached;

    const where: Prisma.ActivityWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.cityId) where.cityId = query.cityId;
    if (query.type) where.type = query.type;

    if (query.minCost !== undefined || query.maxCost !== undefined) {
      where.estimatedCost = {
        ...(query.minCost !== undefined ? { gte: query.minCost } : {}),
        ...(query.maxCost !== undefined ? { lte: query.maxCost } : {}),
      };
    }
    if (query.maxDuration !== undefined) where.durationMinutes = { lte: query.maxDuration };

    const skip = (query.page - 1) * query.limit;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { name: 'asc' }],
        include: { city: { select: { id: true, name: true, country: true, countryCode: true } } },
      }),
      prisma.activity.count({ where }),
    ]);

    const result = { items: activities.map((a) => this.toDto(a)), total };
    await cache.set(cacheKey, result, CACHE_TTL.ACTIVITY_SEARCH);
    return result;
  }

  static async getById(activityId: string) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { city: { select: { id: true, name: true, country: true, countryCode: true } } },
    });
    if (!activity) throw ApiError.notFound('Activity not found');
    return this.toDto(activity);
  }

  // -------------------------------------------------------------------------
  // Scheduling into a stop
  // -------------------------------------------------------------------------

  static async addToStop(
    stopId: string,
    userId: string,
    input: AddStopActivityInput,
    ctx: RequestContext = {},
  ) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        tripId: true,
        cityId: true,
        arrivalDate: true,
        departureDate: true,
        city: { select: { name: true } },
      },
    });
    if (!stop) throw ApiError.notFound('Stop not found');

    await TripService.resolveAccess(stop.tripId, userId, 'edit');

    const activity = await prisma.activity.findUnique({
      where: { id: input.activityId },
      select: { id: true, name: true, cityId: true, estimatedCost: true, durationMinutes: true },
    });
    if (!activity) throw ApiError.badRequest('That activity does not exist');

    // An activity belongs to a city; scheduling it into a stop in a different
    // city would produce a nonsensical itinerary.
    if (activity.cityId !== stop.cityId) {
      throw ApiError.badRequest(
        `"${activity.name}" is not available in ${stop.city.name}`,
      );
    }

    if (input.scheduledDate) {
      const date = toUtcDate(input.scheduledDate);
      if (!isWithinRange(date, stop.arrivalDate, stop.departureDate)) {
        throw ApiError.validation([
          {
            field: 'scheduledDate',
            message: `Must fall between ${toDateString(stop.arrivalDate)} and ${toDateString(stop.departureDate)}`,
          },
        ]);
      }
    }

    const duplicate = await prisma.stopActivity.findUnique({
      where: { stopId_activityId: { stopId, activityId: input.activityId } },
      select: { id: true },
    });
    if (duplicate) throw ApiError.conflict('That activity is already scheduled for this stop');

    const sequence =
      input.sequence ?? (await prisma.stopActivity.count({ where: { stopId } }));

    const created = await prisma.stopActivity.create({
      data: {
        stopId,
        activityId: input.activityId,
        scheduledDate: input.scheduledDate ? toUtcDate(input.scheduledDate) : null,
        startTime: input.startTime,
        endTime: input.endTime,
        sequence,
        costOverride: input.costOverride,
        durationOverride: input.durationOverride,
        notes: input.notes,
      },
      include: { activity: true },
    });

    await BudgetService.recalculate(stop.tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.ACTIVITY_ADDED,
      resourceType: 'stop_activity',
      resourceId: created.id,
      metadata: { tripId: stop.tripId, stopId, activityId: input.activityId },
      ...ctx,
    });

    return this.toStopActivityDto(created);
  }

  static async updateStopActivity(
    stopId: string,
    activityId: string,
    userId: string,
    input: Record<string, unknown>,
    ctx: RequestContext = {},
  ) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, arrivalDate: true, departureDate: true },
    });
    if (!stop) throw ApiError.notFound('Stop not found');

    await TripService.resolveAccess(stop.tripId, userId, 'edit');

    const existing = await prisma.stopActivity.findUnique({
      where: { stopId_activityId: { stopId, activityId } },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound('That activity is not scheduled for this stop');

    if (typeof input.scheduledDate === 'string') {
      const date = toUtcDate(input.scheduledDate);
      if (!isWithinRange(date, stop.arrivalDate, stop.departureDate)) {
        throw ApiError.validation([
          {
            field: 'scheduledDate',
            message: `Must fall between ${toDateString(stop.arrivalDate)} and ${toDateString(stop.departureDate)}`,
          },
        ]);
      }
    }

    const updated = await prisma.stopActivity.update({
      where: { id: existing.id },
      data: {
        ...input,
        ...(typeof input.scheduledDate === 'string'
          ? { scheduledDate: toUtcDate(input.scheduledDate) }
          : {}),
      } as Prisma.StopActivityUpdateInput,
      include: { activity: true },
    });

    await BudgetService.recalculate(stop.tripId);

    AuditService.queue({
      actorId: userId,
      action: 'stop_activity.updated',
      resourceType: 'stop_activity',
      resourceId: updated.id,
      metadata: { tripId: stop.tripId, fields: Object.keys(input) },
      ...ctx,
    });

    return this.toStopActivityDto(updated);
  }

  static async removeFromStop(
    stopId: string,
    activityId: string,
    userId: string,
    ctx: RequestContext = {},
  ) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true },
    });
    if (!stop) throw ApiError.notFound('Stop not found');

    await TripService.resolveAccess(stop.tripId, userId, 'edit');

    const existing = await prisma.stopActivity.findUnique({
      where: { stopId_activityId: { stopId, activityId } },
      select: { id: true, sequence: true },
    });
    if (!existing) throw ApiError.notFound('That activity is not scheduled for this stop');

    await prisma.$transaction(async (tx) => {
      await tx.stopActivity.delete({ where: { id: existing.id } });
      // Keep the per-stop ordering dense.
      await tx.stopActivity.updateMany({
        where: { stopId, sequence: { gt: existing.sequence } },
        data: { sequence: { decrement: 1 } },
      });
    });

    await BudgetService.recalculate(stop.tripId);

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.ACTIVITY_REMOVED,
      resourceType: 'stop_activity',
      resourceId: existing.id,
      metadata: { tripId: stop.tripId, stopId, activityId },
      ...ctx,
    });
  }

  static async listForStop(stopId: string, userId: string) {
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true },
    });
    if (!stop) throw ApiError.notFound('Stop not found');

    await TripService.resolveAccess(stop.tripId, userId, 'view');

    const items = await prisma.stopActivity.findMany({
      where: { stopId },
      orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
      include: { activity: true },
    });

    return items.map((item) => this.toStopActivityDto(item));
  }

  /** Most-scheduled catalog activities — powers admin "popular activities". */
  static async popular(limit = 10) {
    const grouped = await prisma.stopActivity.groupBy({
      by: ['activityId'],
      _count: { activityId: true },
      orderBy: { _count: { activityId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const activities = await prisma.activity.findMany({
      where: { id: { in: grouped.map((g) => g.activityId) } },
      include: { city: { select: { name: true, country: true } } },
    });
    const byId = new Map(activities.map((a) => [a.id, a]));

    return grouped
      .map((g) => {
        const activity = byId.get(g.activityId);
        if (!activity) return null;
        return {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          city: activity.city.name,
          country: activity.city.country,
          imageUrl: activity.imageUrl,
          estimatedCost: toAmount(activity.estimatedCost),
          timesAdded: g._count.activityId,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  private static toDto(
    activity: Prisma.ActivityGetPayload<{
      include: { city: { select: { id: true; name: true; country: true; countryCode: true } } };
    }>,
  ) {
    return {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      description: activity.description,
      imageUrl: activity.imageUrl,
      estimatedCost: toAmount(activity.estimatedCost),
      currency: activity.currency,
      durationMinutes: activity.durationMinutes,
      popularity: activity.popularity,
      city: activity.city,
    };
  }

  private static toStopActivityDto(
    item: Prisma.StopActivityGetPayload<{ include: { activity: true } }>,
  ) {
    return {
      id: item.id,
      stopId: item.stopId,
      activityId: item.activityId,
      name: item.activity.name,
      type: item.activity.type,
      description: item.activity.description,
      imageUrl: item.activity.imageUrl,
      scheduledDate: item.scheduledDate ? toDateString(item.scheduledDate) : null,
      startTime: item.startTime,
      endTime: item.endTime,
      sequence: item.sequence,
      // The effective values after any trip-specific override.
      cost: toAmount(item.costOverride ?? item.activity.estimatedCost),
      currency: item.activity.currency,
      durationMinutes: item.durationOverride ?? item.activity.durationMinutes,
      isCostOverridden: item.costOverride !== null,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

export default ActivityService;
