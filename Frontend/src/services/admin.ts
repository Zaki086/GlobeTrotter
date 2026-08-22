import { USE_MOCK, request, requestPaginated, delay } from '@/lib/api';
import { mockCities, mockActivities, mockTrips, mockCurrentUser } from '@/services/mock-data';
import type {
  AdminAnalytics,
  AdminUserDetail,
  AdminUserListItem,
  Paginated,
  Role,
} from '@/types';

export async function getAnalytics(days = 30): Promise<AdminAnalytics> {
  if (USE_MOCK) {
    await delay();
    const totalUsers = 128;
    const activeUsers = 42;
    const newUsers = 12;
    const totalTrips = mockTrips.length + 24;
    const newTrips = 5;
    const totalStops = mockTrips.reduce((n, t) => n + t.stops.length, 0) + 40;
    const scheduledActivities = mockTrips.reduce(
      (n, t) => n + t.stops.reduce((m, s) => m + s.activities.length, 0),
      0,
    );
    const userGrowth: AdminAnalytics['userGrowth'] = [];
    const tripGrowth: AdminAnalytics['tripGrowth'] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      userGrowth.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 3),
        cumulative: totalUsers - Math.floor(i / 3),
      });
      tripGrowth.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 2),
        cumulative: totalTrips - Math.floor(i / 5),
      });
    }
    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      totals: {
        users: totalUsers,
        trips: totalTrips,
        stops: totalStops,
        scheduledActivities,
        activeShareLinks: 18,
        catalogCities: mockCities.length,
        catalogActivities: mockActivities.length,
      },
      users: {
        total: totalUsers,
        newInWindow: newUsers,
        activeInWindow: activeUsers,
        withAtLeastOneTrip: 64,
        activationRate: 50,
        activeRate: 33,
      },
      trips: {
        total: totalTrips,
        newInWindow: newTrips,
        upcoming: mockTrips.filter((t) => t.status === 'PLANNED').length + 8,
        byStatus: {
          DRAFT: 4,
          PLANNED: 10,
          ONGOING: 3,
          COMPLETED: 8,
          CANCELLED: 1,
        },
        averagePerUser: Number((totalTrips / totalUsers).toFixed(2)),
        averageStopsPerTrip: Number((totalStops / totalTrips).toFixed(2)),
        averageActivitiesPerTrip: Number((scheduledActivities / totalTrips).toFixed(2)),
      },
      popularCities: mockCities.slice(0, 5).map((c) => ({ ...c, tripCount: Math.floor(Math.random() * 20) + 5 })),
      popularActivities: mockActivities.slice(0, 5).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        city: a.city.name,
        country: a.city.country,
        imageUrl: a.imageUrl,
        estimatedCost: a.estimatedCost,
        timesAdded: Math.floor(Math.random() * 50) + 5,
      })),
      userGrowth,
      tripGrowth,
      engagement: {
        shareLinks: 18,
        totalShareViews: 1240,
        totalTripCopies: 42,
        activationRate: 50,
        avgTripBudget: 2840,
        totalPlannedSpend: 2840 * totalTrips,
      },
    };
  }
  return request<AdminAnalytics>({ method: 'GET', url: '/admin/analytics', params: { days } });
}

export async function listUsers(query: { page?: number; limit?: number; search?: string; role?: Role } = {}): Promise<Paginated<AdminUserListItem>> {
  if (USE_MOCK) {
    await delay();
    const items: AdminUserListItem[] = Array.from({ length: 12 }).map((_, i) => ({
      id: `user-${i}`,
      name: `Traveler ${i + 1}`,
      email: `traveler${i + 1}@example.com`,
      role: i === 0 ? 'ADMIN' : 'USER',
      isActive: true,
      emailVerified: i % 2 === 0,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      lastLoginAt: i % 3 === 0 ? new Date().toISOString() : null,
      tripCount: Math.floor(Math.random() * 8),
      sessionCount: Math.floor(Math.random() * 3) + 1,
    }));
    let filtered = items;
    if (query.search) {
      const term = query.search.toLowerCase();
      filtered = filtered.filter(
        (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
      );
    }
    if (query.role) filtered = filtered.filter((u) => u.role === query.role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), total: filtered.length };
  }
  return requestPaginated<AdminUserListItem>({
    url: '/admin/users',
    params: query as Record<string, unknown>,
  });
}

export async function getUser(userId: string): Promise<AdminUserDetail> {
  if (USE_MOCK) {
    await delay();
    return {
      ...mockCurrentUser,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      profile: null,
      trips: mockTrips.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status,
        stopCount: t.stops.length,
      })),
      stats: { tripCount: mockTrips.length, sessionCount: 2, shareLinkCount: 1 },
    };
  }
  return request<AdminUserDetail>({ method: 'GET', url: `/admin/users/${userId}` });
}

export async function updateUser(
  userId: string,
  input: { role?: Role; isActive?: boolean },
): Promise<{ id: string; name: string; email: string; role: Role; isActive: boolean }> {
  if (USE_MOCK) {
    await delay();
    return {
      id: userId,
      name: 'Traveler',
      email: 'traveler@example.com',
      role: input.role ?? 'USER',
      isActive: input.isActive ?? true,
    };
  }
  return request<{ id: string; name: string; email: string; role: Role; isActive: boolean }>({
    method: 'PATCH',
    url: `/admin/users/${userId}`,
    data: input,
  });
}

// ---------------------------------------------------------------------------
// Content oversight
// ---------------------------------------------------------------------------

export interface AdminTripRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isPublic: boolean;
  travelers: number;
  currency: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  estimatedTotal: number;
  stopCount: number;
  memberCount: number;
  shareCount: number;
}

export interface AdminPostRow {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: { id: string; name: string; email: string };
  city: { name: string } | null;
}

export interface AdminCityRow {
  id: string;
  name: string;
  region: string;
  currency: string;
  costIndex: number;
  popularity: number;
  rates: { budget: number; mid: number; luxury: number };
  peakMonths: number[];
  activityCount: number;
  tripCount: number;
}

export interface AdminAuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export async function listAllTrips(query: { page?: number; limit?: number; search?: string } = {}) {
  if (USE_MOCK) {
    await delay();
    return { items: [] as AdminTripRow[], total: 0 };
  }
  return requestPaginated<AdminTripRow>({ url: '/admin/trips', params: query });
}

export async function listAllPosts(query: { page?: number; limit?: number } = {}) {
  if (USE_MOCK) {
    await delay();
    return { items: [] as AdminPostRow[], total: 0 };
  }
  return requestPaginated<AdminPostRow>({ url: '/admin/posts', params: query });
}

export async function listCatalog(query: { page?: number; limit?: number; search?: string } = {}) {
  if (USE_MOCK) {
    await delay();
    return { items: [] as AdminCityRow[], total: 0 };
  }
  return requestPaginated<AdminCityRow>({ url: '/admin/catalog', params: query });
}

export async function listAuditLogs(query: { page?: number; limit?: number; action?: string } = {}) {
  if (USE_MOCK) {
    await delay();
    return { items: [] as AdminAuditRow[], total: 0 };
  }
  return requestPaginated<AdminAuditRow>({ url: '/admin/audit-logs', params: query });
}

/** Adjusts a destination's nightly rate bands — feeds the cost engine. */
export async function updateCityRates(
  cityId: string,
  patch: Partial<{ stayBudget: number; stayMid: number; stayLuxury: number; costIndex: number; popularity: number }>,
) {
  return request<{ id: string; name: string }>({
    method: 'PATCH',
    url: `/admin/catalog/${cityId}/rates`,
    data: patch,
  });
}

/** Moderator removal of a community post. */
export async function moderatePost(postId: string): Promise<void> {
  await request<void>({ method: 'DELETE', url: `/community/${postId}` });
}
