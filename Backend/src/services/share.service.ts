import { Prisma, TripMemberRole, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { cache } from '../config/redis';
import { CACHE_KEY, AUDIT_ACTION, CACHE_TTL } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { buildShareSlug } from '../utils/slug';
import { addDays, diffInDays, toDateString, toUtcDate } from '../utils/dates';
import type { RequestContext } from '../types';
import type { CopyTripInput, CreateShareInput } from '../validators/share.validator';
import { AuditService } from './audit.service';
import { BudgetService } from './budget.service';
import { ItineraryService } from './itinerary.service';
import { NotificationService } from './notification.service';
import { TripService } from './trip.service';

export class ShareService {
  // -------------------------------------------------------------------------
  // Creating and revoking links
  // -------------------------------------------------------------------------

  static async createShareLink(
    tripId: string,
    userId: string,
    input: CreateShareInput,
    ctx: RequestContext = {},
  ) {
    await TripService.requireOwner(tripId, userId);

    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { id: true, name: true },
    });

    // Retry on the astronomically unlikely slug collision rather than 500.
    let share = null;
    for (let attempt = 0; attempt < 5 && !share; attempt++) {
      try {
        share = await prisma.sharedItinerary.create({
          data: {
            tripId,
            createdById: userId,
            slug: buildShareSlug(trip.name),
            allowCopy: input.allowCopy,
            expiresAt: input.expiresInDays
              ? new Date(Date.now() + input.expiresInDays * 86_400_000)
              : null,
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      }
    }
    if (!share) throw ApiError.internal('Could not generate a unique share link');

    await prisma.trip.update({ where: { id: tripId }, data: { isPublic: true } });

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.TRIP_SHARED,
      resourceType: 'trip',
      resourceId: tripId,
      metadata: { slug: share.slug, allowCopy: share.allowCopy },
      ...ctx,
    });

    NotificationService.queue({
      userId,
      type: 'TRIP_SHARED',
      title: `"${trip.name}" is now shareable`,
      body: 'Anyone with the link can view this itinerary.',
      data: { tripId, slug: share.slug },
    });

    await TripService.invalidate(userId, tripId);

    return this.toShareDto(share);
  }

  static async listShareLinks(tripId: string, userId: string) {
    await TripService.resolveAccess(tripId, userId, 'view');

    const shares = await prisma.sharedItinerary.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => this.toShareDto(share));
  }

  static async revokeShareLink(
    tripId: string,
    shareId: string,
    userId: string,
    ctx: RequestContext = {},
  ) {
    await TripService.requireOwner(tripId, userId);

    const share = await prisma.sharedItinerary.findFirst({
      where: { id: shareId, tripId },
      select: { id: true, slug: true },
    });
    if (!share) throw ApiError.notFound('Share link not found');

    await prisma.sharedItinerary.update({
      where: { id: share.id },
      data: { isActive: false },
    });

    // The trip stops being public once its last live link is gone.
    const remaining = await prisma.sharedItinerary.count({
      where: { tripId, isActive: true },
    });
    if (remaining === 0) {
      await prisma.trip.update({ where: { id: tripId }, data: { isPublic: false } });
    }

    await cache.del(CACHE_KEY.publicItinerary(share.slug));

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.SHARE_REVOKED,
      resourceType: 'trip',
      resourceId: tripId,
      metadata: { slug: share.slug },
      ...ctx,
    });
  }

  // -------------------------------------------------------------------------
  // Public read
  // -------------------------------------------------------------------------

  /** Resolves an active, unexpired slug. Used by every public endpoint. */
  private static async resolveActiveShare(slug: string) {
    const share = await prisma.sharedItinerary.findUnique({
      where: { slug },
      select: {
        id: true,
        tripId: true,
        allowCopy: true,
        isActive: true,
        expiresAt: true,
        viewCount: true,
        copyCount: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!share || !share.isActive) throw ApiError.notFound('This itinerary link is no longer available');
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw ApiError.notFound('This itinerary link has expired');
    }

    return share;
  }

  /**
   * The public, read-only itinerary page. Deliberately strips anything the
   * owner has not chosen to publish: no member list, no expense log, no
   * owner email, no internal ids beyond what rendering needs.
   */
  static async getPublicItinerary(slug: string) {
    const share = await this.resolveActiveShare(slug);

    const cacheKey = CACHE_KEY.publicItinerary(slug);
    const cached = await cache.get<Record<string, unknown>>(cacheKey);

    // View counting happens on every hit, cached or not.
    void prisma.sharedItinerary
      .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    if (cached) return cached;

    const itinerary = await ItineraryService.build(share.tripId, 'timeline');

    const budget = await prisma.budget.findUnique({
      where: { tripId: share.tripId },
      select: {
        currency: true,
        transportTotal: true,
        stayTotal: true,
        mealsTotal: true,
        activitiesTotal: true,
        otherTotal: true,
        grandTotal: true,
        perDayAverage: true,
      },
    });

    const payload = {
      slug,
      readOnly: true as const,
      allowCopy: share.allowCopy,
      sharedBy: share.createdBy.name,
      sharedAt: share.createdAt,
      viewCount: share.viewCount + 1,
      copyCount: share.copyCount,
      shareUrl: `${env.PUBLIC_APP_URL}/public/${slug}`,
      trip: itinerary.trip,
      summary: itinerary.summary,
      timeline: itinerary.timeline,
      list: itinerary.list,
      // Totals only — the itemised expense log stays private.
      budget: budget
        ? {
            currency: budget.currency,
            total: Number(budget.grandTotal),
            perDayAverage: Number(budget.perDayAverage),
            breakdown: {
              transport: Number(budget.transportTotal),
              stay: Number(budget.stayTotal),
              meals: Number(budget.mealsTotal),
              activities: Number(budget.activitiesTotal),
              other: Number(budget.otherTotal),
            },
          }
        : null,
    };

    await cache.set(cacheKey, payload, CACHE_TTL.PUBLIC_ITINERARY);
    return payload;
  }

  // -------------------------------------------------------------------------
  // Copy
  // -------------------------------------------------------------------------

  /**
   * Clones a shared itinerary into the caller's account.
   *
   * The copy is a genuinely independent trip: new stop and activity rows, a
   * fresh budget, no members, no share links. Only the catalog references
   * (city, activity) are shared, because those are global reference data.
   *
   * When `startDate` is given the whole plan is shifted by a constant offset,
   * which preserves the relative spacing of every stop and scheduled activity.
   */
  static async copyPublicItinerary(
    slug: string,
    userId: string,
    input: CopyTripInput,
    ctx: RequestContext = {},
  ) {
    const share = await this.resolveActiveShare(slug);

    if (!share.allowCopy) {
      throw ApiError.forbidden('The owner has not allowed this itinerary to be copied');
    }

    const source = await prisma.trip.findUnique({
      where: { id: share.tripId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          include: { activities: { orderBy: { sequence: 'asc' } } },
        },
        budget: { select: { plannedTotal: true, dailyLimit: true } },
      },
    });
    if (!source) throw ApiError.notFound('The original trip no longer exists');

    if (source.ownerId === userId) {
      throw ApiError.badRequest('You already own this trip');
    }

    // Constant day offset applied to every date in the plan.
    const offsetDays = input.startDate ? diffInDays(source.startDate, toUtcDate(input.startDate)) : 0;
    const shift = (date: Date) => addDays(date, offsetDays);

    const copy = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          ownerId: userId,
          name: input.name ?? `${source.name} (copy)`,
          description: source.description,
          coverImageUrl: source.coverImageUrl,
          startDate: shift(source.startDate),
          endDate: shift(source.endDate),
          travelers: source.travelers,
          currency: source.currency,
          // A copy always starts as a private draft, never inheriting the
          // original's public status.
          status: TripStatus.DRAFT,
          isPublic: false,
          members: { create: { userId, role: TripMemberRole.OWNER } },
          budget: {
            create: {
              currency: source.currency,
              plannedTotal: source.budget?.plannedTotal ?? null,
              dailyLimit: source.budget?.dailyLimit ?? null,
            },
          },
        },
      });

      for (const stop of source.stops) {
        await tx.stop.create({
          data: {
            tripId: trip.id,
            cityId: stop.cityId,
            sequence: stop.sequence,
            arrivalDate: shift(stop.arrivalDate),
            departureDate: shift(stop.departureDate),
            notes: stop.notes,
            accommodationCost: stop.accommodationCost,
            transportCost: stop.transportCost,
            mealsPerDayCost: stop.mealsPerDayCost,
            activities: {
              create: stop.activities.map((sa) => ({
                activityId: sa.activityId,
                scheduledDate: sa.scheduledDate ? shift(sa.scheduledDate) : null,
                startTime: sa.startTime,
                endTime: sa.endTime,
                sequence: sa.sequence,
                costOverride: sa.costOverride,
                durationOverride: sa.durationOverride,
                notes: sa.notes,
              })),
            },
          },
        });
      }

      return trip;
    });

    await prisma.sharedItinerary.update({
      where: { id: share.id },
      data: { copyCount: { increment: 1 } },
    });

    await BudgetService.recalculate(copy.id);
    await TripService.invalidate(userId, copy.id);
    await cache.del(CACHE_KEY.publicItinerary(slug));

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.TRIP_COPIED,
      resourceType: 'trip',
      resourceId: copy.id,
      metadata: { sourceTripId: source.id, slug },
      ...ctx,
    });

    NotificationService.queue({
      userId,
      type: 'TRIP_COPIED',
      title: `"${copy.name}" added to your trips`,
      body: 'Copied from a shared itinerary. Adjust the dates and make it yours.',
      data: { tripId: copy.id },
    });

    // Let the original owner see that their plan inspired someone.
    NotificationService.queue({
      userId: source.ownerId,
      type: 'TRIP_COPIED',
      title: `Someone copied "${source.name}"`,
      body: 'Your shared itinerary was copied by another traveler.',
      data: { tripId: source.id, slug },
    });

    return {
      id: copy.id,
      name: copy.name,
      startDate: toDateString(copy.startDate),
      endDate: toDateString(copy.endDate),
      status: copy.status,
      stopCount: source.stops.length,
      shiftedByDays: offsetDays,
    };
  }

  private static toShareDto(share: {
    id: string;
    slug: string;
    allowCopy: boolean;
    isActive: boolean;
    viewCount: number;
    copyCount: number;
    expiresAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: share.id,
      slug: share.slug,
      url: `${env.PUBLIC_APP_URL}/public/${share.slug}`,
      allowCopy: share.allowCopy,
      isActive: share.isActive,
      viewCount: share.viewCount,
      copyCount: share.copyCount,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    };
  }
}

export default ShareService;
