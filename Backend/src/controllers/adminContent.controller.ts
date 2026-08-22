import { prisma } from '../config/prisma';
import { buildPaginationMeta, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { resolvePagination } from '../utils/pagination';
import { toDateString } from '../utils/dates';
import { toAmount } from '../utils/money';
import { AuditService } from '../services/audit.service';

/**
 * Content oversight for admins — the PRD's "user management tools" extended to
 * the things users create. Every destructive action is audited.
 */

/** Every trip on the platform, with its owner — admins see across accounts. */
export const listAllTrips = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(q.page ?? 1),
    limit: Number(q.limit ?? 20),
  });

  const where = q.search
    ? { name: { contains: q.search, mode: 'insensitive' as const } }
    : {};

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        isPublic: true,
        travelers: true,
        currency: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
        budget: { select: { grandTotal: true } },
        _count: { select: { stops: true, members: true, shares: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return sendSuccess(
    res,
    trips.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: toDateString(t.startDate),
      endDate: toDateString(t.endDate),
      status: t.status,
      isPublic: t.isPublic,
      travelers: t.travelers,
      currency: t.currency,
      createdAt: t.createdAt,
      owner: t.owner,
      estimatedTotal: toAmount(t.budget?.grandTotal ?? 0),
      stopCount: t._count.stops,
      memberCount: t._count.members,
      shareCount: t._count.shares,
    })),
    'Trips retrieved',
    200,
    buildPaginationMeta(page, limit, total),
  );
});

/** Community moderation queue. */
export const listAllPosts = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(q.page ?? 1),
    limit: Number(q.limit ?? 20),
  });

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        tags: true,
        rating: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
        city: { select: { name: true } },
      },
    }),
    prisma.communityPost.count(),
  ]);

  return sendSuccess(res, posts, 'Posts retrieved', 200, buildPaginationMeta(page, limit, total));
});

/** The seeded destination catalog, with usage counts. */
export const listCatalog = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(q.page ?? 1),
    limit: Number(q.limit ?? 25),
  });

  const where = q.search
    ? { name: { contains: q.search, mode: 'insensitive' as const } }
    : {};

  const [cities, total] = await Promise.all([
    prisma.city.findMany({
      where,
      skip,
      take,
      orderBy: { popularity: 'desc' },
      select: {
        id: true,
        name: true,
        region: true,
        currency: true,
        costIndex: true,
        popularity: true,
        stayBudget: true,
        stayMid: true,
        stayLuxury: true,
        peakMonths: true,
        _count: { select: { activities: true, stops: true } },
      },
    }),
    prisma.city.count({ where }),
  ]);

  return sendSuccess(
    res,
    cities.map((c) => ({
      id: c.id,
      name: c.name,
      region: c.region,
      currency: c.currency,
      costIndex: c.costIndex,
      popularity: c.popularity,
      rates: { budget: c.stayBudget, mid: c.stayMid, luxury: c.stayLuxury },
      peakMonths: c.peakMonths,
      activityCount: c._count.activities,
      tripCount: c._count.stops,
    })),
    'Catalog retrieved',
    200,
    buildPaginationMeta(page, limit, total),
  );
});

/** Adjusts a destination's nightly rate bands — feeds the cost engine. */
export const updateCityRates = asyncHandler(async (req, res) => {
  const { cityId } = req.params;
  const { stayBudget, stayMid, stayLuxury, costIndex, popularity } = req.body as Record<
    string,
    number | undefined
  >;

  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
  if (!city) throw ApiError.notFound('City not found');

  const updated = await prisma.city.update({
    where: { id: cityId },
    data: {
      ...(stayBudget !== undefined ? { stayBudget } : {}),
      ...(stayMid !== undefined ? { stayMid } : {}),
      ...(stayLuxury !== undefined ? { stayLuxury } : {}),
      ...(costIndex !== undefined ? { costIndex } : {}),
      ...(popularity !== undefined ? { popularity } : {}),
    },
    select: { id: true, name: true, stayBudget: true, stayMid: true, stayLuxury: true },
  });

  AuditService.queue({
    actorId: req.auth!.userId,
    action: 'admin.city_rates_updated',
    resourceType: 'city',
    resourceId: cityId,
    metadata: { stayBudget, stayMid, stayLuxury, costIndex, popularity },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, updated, 'Rates updated');
});
