import { Prisma, Role, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, AUDIT_ACTION, CACHE_TTL } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { toAmount } from '../utils/money';
import { toDateString, toUtcDate } from '../utils/dates';
import type { RequestContext } from '../types';
import type { AnalyticsQuery, ListUsersQuery } from '../validators/admin.validator';
import { ActivityService } from './activity.service';
import { AuditService } from './audit.service';
import { CityService } from './city.service';

export class AdminService {
  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  static async analytics(query: AnalyticsQuery, actorId: string, ctx: RequestContext = {}) {
    const cacheKey = `${CACHE_KEY.adminAnalytics()}:${query.days}:${query.limit}`;
    const cached = await cache.get<Record<string, unknown>>(cacheKey);

    AuditService.queue({
      actorId,
      action: AUDIT_ACTION.ADMIN_ANALYTICS_VIEWED,
      resourceType: 'admin',
      metadata: { days: query.days },
      ...ctx,
    });

    if (cached) return cached;

    const since = new Date(Date.now() - query.days * 86_400_000);
    const today = toUtcDate(new Date());

    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalTrips,
      newTrips,
      tripsByStatus,
      totalStops,
      totalActivitiesScheduled,
      totalShares,
      totalCopies,
      budgetTotals,
      popularCities,
      popularActivities,
      userGrowth,
      tripGrowth,
      engagedUsers,
      upcomingTrips,
      catalogCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.trip.count(),
      prisma.trip.count({ where: { createdAt: { gte: since } } }),
      prisma.trip.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.stop.count(),
      prisma.stopActivity.count(),
      prisma.sharedItinerary.count({ where: { isActive: true } }),
      prisma.sharedItinerary.aggregate({ _sum: { copyCount: true, viewCount: true } }),
      prisma.budget.aggregate({ _sum: { grandTotal: true }, _avg: { grandTotal: true } }),
      CityService.popular(query.limit),
      ActivityService.popular(query.limit),
      this.dailySeries('users', since),
      this.dailySeries('trips', since),
      // Users who created at least one trip — the core engagement signal.
      prisma.trip.findMany({ distinct: ['ownerId'], select: { ownerId: true } }),
      prisma.trip.count({ where: { startDate: { gt: today } } }),
      Promise.all([prisma.city.count(), prisma.activity.count()]),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(TripStatus).map((status) => [
        status,
        tripsByStatus.find((t) => t.status === status)?._count.status ?? 0,
      ]),
    ) as Record<TripStatus, number>;

    const usersWithTrips = engagedUsers.length;
    const [cityCount, activityCount] = catalogCounts;

    const result = {
      generatedAt: new Date().toISOString(),
      windowDays: query.days,

      totals: {
        users: totalUsers,
        trips: totalTrips,
        stops: totalStops,
        scheduledActivities: totalActivitiesScheduled,
        activeShareLinks: totalShares,
        catalogCities: cityCount,
        catalogActivities: activityCount,
      },

      users: {
        total: totalUsers,
        newInWindow: newUsers,
        activeInWindow: activeUsers,
        withAtLeastOneTrip: usersWithTrips,
        // Guarded against divide-by-zero on an empty platform.
        activationRate: totalUsers ? Number(((usersWithTrips / totalUsers) * 100).toFixed(1)) : 0,
        activeRate: totalUsers ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 0,
      },

      trips: {
        total: totalTrips,
        newInWindow: newTrips,
        upcoming: upcomingTrips,
        byStatus: statusCounts,
        averagePerUser: totalUsers ? Number((totalTrips / totalUsers).toFixed(2)) : 0,
        averageStopsPerTrip: totalTrips ? Number((totalStops / totalTrips).toFixed(2)) : 0,
        averageActivitiesPerTrip: totalTrips
          ? Number((totalActivitiesScheduled / totalTrips).toFixed(2))
          : 0,
      },

      popularCities,
      popularActivities,

      userGrowth,
      tripGrowth,

      engagement: {
        shareLinks: totalShares,
        totalShareViews: totalCopies._sum.viewCount ?? 0,
        totalTripCopies: totalCopies._sum.copyCount ?? 0,
        activationRate: totalUsers ? Number(((usersWithTrips / totalUsers) * 100).toFixed(1)) : 0,
        avgTripBudget: toAmount(budgetTotals._avg.grandTotal ?? 0),
        totalPlannedSpend: toAmount(budgetTotals._sum.grandTotal ?? 0),
      },
    };

    await cache.set(cacheKey, result, CACHE_TTL.ADMIN_ANALYTICS);
    return result;
  }

  /**
   * Daily signup/creation counts for the growth chart.
   *
   * Grouping by day is done in SQL rather than in JS so the whole table never
   * has to be pulled into memory. The table name is not interpolated from user
   * input — it is chosen from a closed set here.
   */
  private static async dailySeries(table: 'users' | 'trips', since: Date) {
    const rows =
      table === 'users'
        ? await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
            SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
            FROM users
            WHERE created_at >= ${since}
            GROUP BY day
            ORDER BY day ASC
          `
        : await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
            SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
            FROM trips
            WHERE created_at >= ${since}
            GROUP BY day
            ORDER BY day ASC
          `;

    let cumulative = 0;
    return rows.map((row) => {
      cumulative += Number(row.count);
      return { date: toDateString(row.day), count: Number(row.count), cumulative };
    });
  }

  // -------------------------------------------------------------------------
  // User management
  // -------------------------------------------------------------------------

  static async listUsers(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const skip = (query.page - 1) * query.limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { trips: true, sessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        tripCount: user._count.trips,
        sessionCount: user._count.sessions,
      })),
      total,
    };
  }

  static async updateUser(
    targetUserId: string,
    actorId: string,
    input: { role?: Role; isActive?: boolean },
    ctx: RequestContext = {},
  ) {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) throw ApiError.notFound('User not found');

    // An admin locking themselves out would need database access to recover.
    if (targetUserId === actorId) {
      if (input.isActive === false) throw ApiError.badRequest('You cannot deactivate your own account');
      if (input.role && input.role !== Role.ADMIN) {
        throw ApiError.badRequest('You cannot remove your own admin role');
      }
    }

    // Never leave the platform with zero admins.
    if (target.role === Role.ADMIN && (input.role === Role.USER || input.isActive === false)) {
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, isActive: true, id: { not: targetUserId } },
      });
      if (activeAdmins === 0) {
        throw ApiError.conflict('At least one active admin must remain');
      }
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: input,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Deactivation must take effect immediately, not when tokens expire.
    if (input.isActive === false) {
      const now = new Date();
      await prisma.$transaction([
        prisma.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: now },
        }),
        prisma.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: now },
        }),
      ]);
    }

    await AuditService.record({
      actorId,
      action: AUDIT_ACTION.ADMIN_USER_UPDATED,
      resourceType: 'user',
      resourceId: targetUserId,
      metadata: { changes: input, previous: { role: target.role, isActive: target.isActive } },
      ...ctx,
    });

    await cache.delPattern(`${CACHE_KEY.adminAnalytics()}*`);

    return user;
  }

  static async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        profile: true,
        trips: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            _count: { select: { stops: true } },
          },
        },
        _count: { select: { trips: true, sessions: true, sharedLinks: true } },
      },
    });
    if (!user) throw ApiError.notFound('User not found');

    return {
      ...user,
      trips: user.trips.map((trip) => ({
        ...trip,
        startDate: toDateString(trip.startDate),
        endDate: toDateString(trip.endDate),
        stopCount: trip._count.stops,
      })),
      stats: {
        tripCount: user._count.trips,
        sessionCount: user._count.sessions,
        shareLinkCount: user._count.sharedLinks,
      },
    };
  }
}

export default AdminService;
