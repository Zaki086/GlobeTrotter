import { USE_MOCK, request, delay } from '@/lib/api';
import { mockActivities } from '@/services/mock-data';
import type { Activity, ActivityType, ListActivitiesQuery, Paginated } from '@/types';

export async function searchActivities(
  query: ListActivitiesQuery = {},
): Promise<Paginated<Activity>> {
  if (USE_MOCK) {
    await delay();
    let items = [...mockActivities];
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          (a.description ?? '').toLowerCase().includes(term),
      );
    }
    if (query.cityId) items = items.filter((a) => a.cityId === query.cityId);
    if (query.type) items = items.filter((a) => a.type === query.type);
    if (query.minCost !== undefined) items = items.filter((a) => a.estimatedCost >= query.minCost!);
    if (query.maxCost !== undefined) items = items.filter((a) => a.estimatedCost <= query.maxCost!);
    if (query.maxDuration !== undefined)
      items = items.filter((a) => a.durationMinutes <= query.maxDuration!);

    const sortBy = query.sortBy ?? 'popularity';
    const sortOrder = query.sortOrder ?? 'desc';
    items.sort((a, b) => {
      const av = a[sortBy] as string | number;
      const bv = b[sortBy] as string | number;
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total: items.length };
  }
  return request<Paginated<Activity>>({
    method: 'GET',
    url: '/activities',
    params: query as Record<string, unknown>,
  });
}

export async function getActivity(id: string): Promise<Activity> {
  if (USE_MOCK) {
    await delay();
    const activity = mockActivities.find((a) => a.id === id);
    if (!activity) throw new Error('Activity not found');
    return activity;
  }
  return request<Activity>({ method: 'GET', url: `/activities/${id}` });
}

export async function getPopularActivities(limit = 10): Promise<Activity[]> {
  if (USE_MOCK) {
    await delay();
    return [...mockActivities].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
  }
  return request<Activity[]>({ method: 'GET', url: '/activities/popular', params: { limit } });
}
