import { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, CACHE_TTL } from '../config/constants';
import { toAmount } from '../utils/money';
import { daysUntil, inclusiveDayCount, toDateString, toUtcDate } from '../utils/dates';
import { CityService } from './city.service';

const dashboardTripSelect = {
  id: true,
  name: true,
  description: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  travelers: true,
  currency: true,
  status: true,
  isPublic: true,
  budget: { select: { grandTotal: true, plannedTotal: true } },
  stops: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      city: { select: { name: true, country: true, imageUrl: true } },
      _count: { select: { activities: true } },
    },
  },
} satisfies Prisma.TripSelect;

type DashboardTrip = Prisma.TripGetPayload<{ select: typeof dashboardTripSelect }>;

/**
 * Assembles the home screen in one round trip: upcoming and recent trips,
 * budget totals, recommended cities and countdowns. Cached briefly per user
 * because it fans out into several aggregate queries.
 */
export class DashboardService {
  static async get(userId: string) {
    const cacheKey = CACHE_KEY.dashboard(userId);
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const today = toUtcDate(new Date());

    // Any trip the user owns or was invited to.
    const visible: Prisma.TripWhereInput = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };

    const [user, upcoming, ongoing, recent, totals, tripCount, notificationCount, recommended] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            email: true,
            profile: { select: { avatarUrl: true, currency: true, language: true } },
          },
        }),

        prisma.trip.findMany({
          where: { ...visible, startDate: { gt: today } },
          orderBy: { startDate: 'asc' },
          take: 5,
          select: dashboardTripSelect,
        }),

        prisma.trip.findMany({
          where: { ...visible, startDate: { lte: today }, endDate: { gte: today } },
          orderBy: { startDate: 'asc' },
          take: 3,
          select: dashboardTripSelect,
        }),

        prisma.trip.findMany({
          where: visible,
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: dashboardTripSelect,
        }),

        // Budget rollups across every visible trip.
        prisma.budget.aggregate({
          where: { trip: visible },
          _sum: { grandTotal: true, plannedTotal: true },
          _avg: { perDayAverage: true },
        }),

        prisma.trip.groupBy({
          by: ['status'],
          where: visible,
          _count: { status: true },
        }),

        prisma.notification.count({ where: { userId, readAt: null } }),

        CityService.recommended(userId, 6),
      ]);

    const statusCounts = Object.fromEntries(
      Object.values(TripStatus).map((status) => [
        status,
        tripCount.find((t) => t.status === status)?._count.status ?? 0,
      ]),
    ) as Record<TripStatus, number>;

    const totalTrips = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    const result = {
      user: {
        name: user?.name ?? '',
        email: user?.email ?? '',
        avatarUrl: user?.profile?.avatarUrl ?? null,
        currency: user?.profile?.currency ?? 'USD',
        language: user?.profile?.language ?? 'en',
      },

      welcomeMessage: buildWelcome(user?.name ?? 'traveler', upcoming[0]),

      stats: {
        totalTrips,
        upcomingTrips: upcoming.length,
        ongoingTrips: ongoing.length,
        completedTrips: statusCounts.COMPLETED,
        byStatus: statusCounts,
        unreadNotifications: notificationCount,
      },

      upcomingTrips: upcoming.map(toDashboardCard),
      ongoingTrips: ongoing.map(toDashboardCard),
      recentTrips: recent.map(toDashboardCard),

      // Countdown widgets, nearest trip first.
      countdowns: upcoming.map((trip) => ({
        tripId: trip.id,
        tripName: trip.name,
        startDate: toDateString(trip.startDate),
        daysRemaining: daysUntil(trip.startDate),
        coverImageUrl: trip.coverImageUrl,
        firstCity: trip.stops[0]?.city.name ?? null,
      })),

      budgetSummary: {
        totalEstimated: toAmount(totals._sum.grandTotal ?? 0),
        totalPlanned: toAmount(totals._sum.plannedTotal ?? 0),
        averagePerDay: toAmount(totals._avg.perDayAverage ?? 0),
        // Highlighted per-trip figures for the "budget highlights" panel.
        highlights: [...upcoming, ...ongoing].slice(0, 3).map((trip) => ({
          tripId: trip.id,
          tripName: trip.name,
          currency: trip.currency,
          estimated: toAmount(trip.budget?.grandTotal ?? 0),
          planned: trip.budget?.plannedTotal ? toAmount(trip.budget.plannedTotal) : null,
          isOverBudget:
            trip.budget?.plannedTotal !== null &&
            trip.budget?.plannedTotal !== undefined &&
            toAmount(trip.budget.grandTotal) > toAmount(trip.budget.plannedTotal),
        })),
      },

      recommendedCities: recommended,
    };

    await cache.set(cacheKey, result, CACHE_TTL.DASHBOARD);
    return result;
  }
}

function toDashboardCard(trip: DashboardTrip) {
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
    activityCount: trip.stops.reduce((n, s) => n + s._count.activities, 0),
    destinations: trip.stops.map((s) => s.city.name),
    countries: [...new Set(trip.stops.map((s) => s.city.country))],
    heroImage: trip.coverImageUrl ?? trip.stops[0]?.city.imageUrl ?? null,
    estimatedTotal: toAmount(trip.budget?.grandTotal ?? 0),
  };
}

function buildWelcome(name: string, nextTrip?: DashboardTrip): string {
  const firstName = name.split(' ')[0];
  if (!nextTrip) return `Welcome back, ${firstName}! Ready to plan your next adventure?`;

  const days = daysUntil(nextTrip.startDate);
  if (days <= 0) return `Welcome back, ${firstName}! Your trip "${nextTrip.name}" starts today.`;
  if (days === 1) return `Welcome back, ${firstName}! "${nextTrip.name}" starts tomorrow.`;
  return `Welcome back, ${firstName}! ${days} days until "${nextTrip.name}".`;
}

export default DashboardService;
