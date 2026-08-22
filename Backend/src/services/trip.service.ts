import { Prisma, TripMemberRole, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, AUDIT_ACTION } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { toAmount } from '../utils/money';
import { inclusiveDayCount, toDateString, toUtcDate, daysUntil } from '../utils/dates';
import type { RequestContext, TripAccess } from '../types';
import type { CreateTripInput, ListTripsQuery, UpdateTripInput } from '../validators/trip.validator';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { BudgetService } from './budget.service';

/** Shape returned to clients for a trip summary card. */
export interface TripSummary {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  daysUntilStart: number;
  travelers: number;
  currency: string;
  status: TripStatus;
  isPublic: boolean;
  stopCount: number;
  activityCount: number;
  cities: string[];
  estimatedTotal: number;
  role: TripMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

const tripSummarySelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  travelers: true,
  currency: true,
  status: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
  budget: { select: { grandTotal: true } },
  stops: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      city: { select: { name: true, country: true } },
      _count: { select: { activities: true } },
    },
  },
} satisfies Prisma.TripSelect;

type TripWithSummary = Prisma.TripGetPayload<{ select: typeof tripSummarySelect }>;

export class TripService {
  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  /**
   * Single authority for "may this user touch this trip?". Every trip-scoped
   * service call goes through here, so there is exactly one place where the
   * ownership rules live.
   */
  static async resolveAccess(
    tripId: string,
    userId: string,
    required: 'view' | 'edit' = 'view',
  ): Promise<TripAccess> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });

    // 404 rather than 403 for non-members: existence itself is private.
    if (!trip) throw ApiError.notFound('Trip not found');

    const isOwner = trip.ownerId === userId;
    const membership = trip.members[0];

    if (!isOwner && !membership) throw ApiError.notFound('Trip not found');

    const role = isOwner ? TripMemberRole.OWNER : membership.role;
    const canEdit = role === TripMemberRole.OWNER || role === TripMemberRole.EDITOR;

    if (required === 'edit' && !canEdit) {
      throw ApiError.forbidden('You have view-only access to this trip');
    }

    return { tripId: trip.id, role, isOwner, canEdit };
  }

  static async requireOwner(tripId: string, userId: string): Promise<TripAccess> {
    const access = await this.resolveAccess(tripId, userId, 'edit');
    if (!access.isOwner) throw ApiError.forbidden('Only the trip owner can perform this action');
    return access;
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  static async create(
    userId: string,
    input: CreateTripInput,
    ctx: RequestContext = {},
  ): Promise<TripSummary> {
    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          ownerId: userId,
          name: input.name,
          description: input.description,
          coverImageUrl: input.coverImageUrl,
          startDate: toUtcDate(input.startDate),
          endDate: toUtcDate(input.endDate),
          travelers: input.travelers,
          currency: input.currency,
          status: input.status,
          // The owner is also a member row so member queries need no special case.
          members: { create: { userId, role: TripMemberRole.OWNER } },
          budget: {
            create: {
              currency: input.currency,
              plannedTotal: input.plannedTotal ?? null,
            },
          },
        },
        select: tripSummarySelect,
      });
      return created;
    });

    await this.invalidate(userId, trip.id);

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.TRIP_CREATED,
      resourceType: 'trip',
      resourceId: trip.id,
      metadata: { name: trip.name },
      ...ctx,
    });

    NotificationService.queue({
      userId,
      type: 'TRIP_CREATED',
      title: `Trip "${trip.name}" created`,
      body: `Your trip runs from ${toDateString(trip.startDate)} to ${toDateString(trip.endDate)}.`,
      data: { tripId: trip.id },
    });

    return this.toSummary(trip, userId);
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  static async list(userId: string, query: ListTripsQuery) {
    const today = toUtcDate(new Date());

    // Trips the user owns *or* was invited to.
    const where: Prisma.TripWhereInput = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };

    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query.status) where.status = query.status;

    // Date buckets are computed against the trip's own range, not its status,
    // so a trip left as PLANNED still shows up as "past" once it has ended.
    if (query.filter === 'upcoming') where.startDate = { gt: today };
    else if (query.filter === 'past') where.endDate = { lt: today };
    else if (query.filter === 'ongoing') {
      where.startDate = { lte: today };
      where.endDate = { gte: today };
    }

    const skip = (query.page - 1) * query.limit;

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        select: tripSummarySelect,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: query.limit,
      }),
      prisma.trip.count({ where }),
    ]);

    return {
      items: trips.map((trip) => this.toSummary(trip, userId)),
      total,
    };
  }

  static async getById(tripId: string, userId: string) {
    const access = await this.resolveAccess(tripId, userId, 'view');

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        budget: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        stops: {
          orderBy: { sequence: 'asc' },
          include: {
            city: true,
            activities: {
              orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
              include: { activity: true },
            },
          },
        },
        shares: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            allowCopy: true,
            viewCount: true,
            copyCount: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!trip) throw ApiError.notFound('Trip not found');

    return {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      durationDays: inclusiveDayCount(trip.startDate, trip.endDate),
      daysUntilStart: daysUntil(trip.startDate),
      travelers: trip.travelers,
      currency: trip.currency,
      status: trip.status,
      isPublic: trip.isPublic,
      owner: trip.owner,
      role: access.role,
      canEdit: access.canEdit,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      members: trip.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      stops: trip.stops.map((stop) => ({
        id: stop.id,
        sequence: stop.sequence,
        arrivalDate: toDateString(stop.arrivalDate),
        departureDate: toDateString(stop.departureDate),
        nights: Math.max(0, inclusiveDayCount(stop.arrivalDate, stop.departureDate) - 1),
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
          imageUrl: stop.city.imageUrl,
          costIndex: stop.city.costIndex,
          // The builder projects the route from these; without them the
          // client computes NaN coordinates and draws nothing.
          latitude: Number(stop.city.latitude),
          longitude: Number(stop.city.longitude),
          timezone: stop.city.timezone,
          currency: stop.city.currency,
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
          durationMinutes: sa.durationOverride ?? sa.activity.durationMinutes,
          notes: sa.notes,
        })),
      })),
      budget: trip.budget
        ? {
            currency: trip.budget.currency,
            plannedTotal: trip.budget.plannedTotal ? toAmount(trip.budget.plannedTotal) : null,
            grandTotal: toAmount(trip.budget.grandTotal),
            perDayAverage: toAmount(trip.budget.perDayAverage),
            lastCalculatedAt: trip.budget.lastCalculatedAt,
          }
        : null,
      shares: trip.shares,
    };
  }

  // -------------------------------------------------------------------------
  // Update / delete
  // -------------------------------------------------------------------------

  static async update(
    tripId: string,
    userId: string,
    input: UpdateTripInput,
    ctx: RequestContext = {},
  ): Promise<TripSummary> {
    await this.resolveAccess(tripId, userId, 'edit');

    const current = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { startDate: true, endDate: true, currency: true },
    });

    const startDate = input.startDate ? toUtcDate(input.startDate) : current.startDate;
    const endDate = input.endDate ? toUtcDate(input.endDate) : current.endDate;

    // A one-sided date update can still invert the range, so re-check here.
    if (endDate < startDate) {
      throw ApiError.validation([
        { field: 'endDate', message: 'End date must be on or after the start date' },
      ]);
    }

    // Narrowing the range must not orphan stops outside it.
    if (input.startDate || input.endDate) {
      const outside = await prisma.stop.count({
        where: {
          tripId,
          OR: [{ arrivalDate: { lt: startDate } }, { departureDate: { gt: endDate } }],
        },
      });
      if (outside > 0) {
        throw ApiError.conflict(
          `${outside} stop(s) fall outside the new date range. Move or remove them first.`,
        );
      }
    }

    const { plannedTotal, ...tripFields } = input;

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        ...tripFields,
        ...(input.startDate ? { startDate } : {}),
        ...(input.endDate ? { endDate } : {}),
      },
      select: tripSummarySelect,
    });

    // Budget mirrors the trip currency and holds the optional ceiling.
    if (plannedTotal !== undefined || input.currency) {
      await prisma.budget.upsert({
        where: { tripId },
        create: {
          tripId,
          currency: input.currency ?? current.currency,
          plannedTotal: plannedTotal ?? null,
        },
        update: {
          ...(plannedTotal !== undefined ? { plannedTotal } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
        },
      });
    }

    // Date or traveler changes move the money, so recompute the rollup.
    if (input.startDate || input.endDate || input.travelers !== undefined || plannedTotal !== undefined) {
      await BudgetService.recalculate(tripId);
    }

    await this.invalidate(userId, tripId);

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.TRIP_UPDATED,
      resourceType: 'trip',
      resourceId: tripId,
      metadata: { fields: Object.keys(input) },
      ...ctx,
    });

    return this.toSummary(trip, userId);
  }

  static async remove(tripId: string, userId: string, ctx: RequestContext = {}): Promise<void> {
    // Deleting cascades to stops, activities, budget and shares — owner only.
    await this.requireOwner(tripId, userId);

    const trip = await prisma.trip.delete({
      where: { id: tripId },
      select: { id: true, name: true },
    });

    await this.invalidate(userId, tripId);

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.TRIP_DELETED,
      resourceType: 'trip',
      resourceId: trip.id,
      metadata: { name: trip.name },
      ...ctx,
    });
  }

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  static async addMember(
    tripId: string,
    userId: string,
    input: { email: string; role: 'EDITOR' | 'VIEWER' },
    ctx: RequestContext = {},
  ) {
    await this.requireOwner(tripId, userId);

    const invitee = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true },
    });
    if (!invitee) throw ApiError.notFound('No account exists with that email address');
    if (invitee.id === userId) throw ApiError.badRequest('You already own this trip');

    const existing = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: invitee.id } },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict('This person is already a member of the trip');

    const member = await prisma.tripMember.create({
      data: { tripId, userId: invitee.id, role: input.role as TripMemberRole },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { name: true },
    });

    NotificationService.queue({
      userId: invitee.id,
      type: 'MEMBER_ADDED',
      title: `You were added to "${trip.name}"`,
      body: `You now have ${input.role.toLowerCase()} access to this trip.`,
      data: { tripId },
    });

    AuditService.queue({
      actorId: userId,
      action: 'trip.member_added',
      resourceType: 'trip',
      resourceId: tripId,
      metadata: { memberId: invitee.id, role: input.role },
      ...ctx,
    });

    await this.invalidate(invitee.id, tripId);

    return { id: member.id, role: member.role, joinedAt: member.joinedAt, user: member.user };
  }

  static async removeMember(
    tripId: string,
    userId: string,
    memberId: string,
    ctx: RequestContext = {},
  ) {
    await this.requireOwner(tripId, userId);

    const member = await prisma.tripMember.findFirst({
      where: { id: memberId, tripId },
      select: { id: true, userId: true, role: true },
    });
    if (!member) throw ApiError.notFound('Member not found on this trip');
    if (member.role === TripMemberRole.OWNER) {
      throw ApiError.badRequest('The trip owner cannot be removed');
    }

    await prisma.tripMember.delete({ where: { id: member.id } });

    AuditService.queue({
      actorId: userId,
      action: 'trip.member_removed',
      resourceType: 'trip',
      resourceId: tripId,
      metadata: { memberId: member.userId },
      ...ctx,
    });

    await this.invalidate(member.userId, tripId);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private static toSummary(trip: TripWithSummary, userId: string): TripSummary {
    const cities = trip.stops.map((s) => s.city.name);
    const activityCount = trip.stops.reduce((sum, s) => sum + s._count.activities, 0);

    return {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      durationDays: inclusiveDayCount(trip.startDate, trip.endDate),
      daysUntilStart: daysUntil(trip.startDate),
      travelers: trip.travelers,
      currency: trip.currency,
      status: trip.status,
      isPublic: trip.isPublic,
      stopCount: trip.stops.length,
      activityCount,
      cities,
      estimatedTotal: toAmount(trip.budget?.grandTotal ?? 0),
      role: trip.ownerId === userId ? TripMemberRole.OWNER : TripMemberRole.VIEWER,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
    };
  }

  /** Drops any cached view that could now be stale. */
  static async invalidate(userId: string, tripId?: string): Promise<void> {
    await cache.del(CACHE_KEY.dashboard(userId));
    if (tripId) await cache.delPattern(CACHE_KEY.tripPattern(tripId));
  }

  /** Invalidates the dashboard for everyone who can see the trip. */
  static async invalidateForMembers(tripId: string): Promise<void> {
    const members = await prisma.tripMember.findMany({
      where: { tripId },
      select: { userId: true },
    });
    await Promise.all(members.map((m) => cache.del(CACHE_KEY.dashboard(m.userId))));
    await cache.delPattern(CACHE_KEY.tripPattern(tripId));
  }
}

export default TripService;
