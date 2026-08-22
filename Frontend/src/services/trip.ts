import { USE_MOCK, request, delay } from '@/lib/api';
import {
  mockTrips,
  getTripById,
  toTripSummary,
  getItinerary,
  getCalendar,
  computeBudget,
} from '@/services/mock-data';
import type {
  CreateShareInput,
  CreateStopInput,
  CreateTripInput,
  Itinerary,
  ListTripsQuery,
  Paginated,
  ShareLink,
  Stop,
  TripCalendar,
  TripDetail,
  TripMember,
  TripSummary,
  UpdateTripInput,
} from '@/types';

export async function createTrip(input: CreateTripInput): Promise<TripSummary> {
  if (USE_MOCK) {
    await delay();
    const id = `trip-${Date.now()}`;
    const trip: TripDetail = {
      id,
      name: input.name,
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      durationDays: 0,
      daysUntilStart: 0,
      travelers: input.travelers,
      currency: input.currency,
      status: input.status ?? 'PLANNED',
      isPublic: false,
      owner: { id: 'user-1', name: 'Alex Wanderer', email: 'alex@example.com' },
      role: 'OWNER',
      canEdit: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [],
      stops: [],
      budget: {
        currency: input.currency,
        plannedTotal: input.plannedTotal ?? null,
        grandTotal: 0,
        perDayAverage: 0,
        lastCalculatedAt: new Date().toISOString(),
      },
      shares: [],
    };
    mockTrips.push(computeBudget(trip));
    return toTripSummary(trip);
  }
  return request<TripSummary>({ method: 'POST', url: '/trips', data: input });
}

export async function listTrips(query: ListTripsQuery = {}): Promise<Paginated<TripSummary>> {
  if (USE_MOCK) {
    await delay();
    let items = mockTrips.map(toTripSummary);
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (t) => t.name.toLowerCase().includes(term) || (t.description ?? '').toLowerCase().includes(term),
      );
    }
    if (query.status) items = items.filter((t) => t.status === query.status);
    if (query.filter === 'upcoming') items = items.filter((t) => t.daysUntilStart > 0);
    if (query.filter === 'past') items = items.filter((t) => t.status === 'COMPLETED');
    if (query.filter === 'ongoing') items = items.filter((t) => t.status === 'ONGOING');

    const sortBy = query.sortBy ?? 'updatedAt';
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
  return request<Paginated<TripSummary>>({ method: 'GET', url: '/trips', params: query as Record<string, unknown> });
}

export async function getTrip(id: string): Promise<TripDetail> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(id);
    if (!trip) throw new Error('Trip not found');
    return trip;
  }
  return request<TripDetail>({ method: 'GET', url: `/trips/${id}` });
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<TripSummary> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(id);
    if (!trip) throw new Error('Trip not found');
    Object.assign(trip, input, { updatedAt: new Date().toISOString() });
    return toTripSummary(computeBudget(trip));
  }
  return request<TripSummary>({ method: 'PATCH', url: `/trips/${id}`, data: input });
}

export async function deleteTrip(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const idx = mockTrips.findIndex((t) => t.id === id);
    if (idx >= 0) mockTrips.splice(idx, 1);
    return;
  }
  await request<void>({ method: 'DELETE', url: `/trips/${id}` });
}

export async function getTripItinerary(
  id: string,
  view: 'timeline' | 'list' = 'timeline',
): Promise<Itinerary> {
  if (USE_MOCK) {
    await delay();
    return getItinerary(id, view);
  }
  return request<Itinerary>({ method: 'GET', url: `/trips/${id}/itinerary`, params: { view } });
}

export async function getTripCalendar(id: string): Promise<TripCalendar> {
  if (USE_MOCK) {
    await delay();
    return getCalendar(id);
  }
  return request<TripCalendar>({ method: 'GET', url: `/trips/${id}/calendar` });
}

export async function listTripStops(id: string): Promise<Stop[]> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(id);
    if (!trip) throw new Error('Trip not found');
    return trip.stops;
  }
  return request<Stop[]>({ method: 'GET', url: `/trips/${id}/stops` });
}

export async function addTripMember(
  tripId: string,
  email: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<TripMember> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    const member: TripMember = {
      id: `member-${Date.now()}`,
      role,
      joinedAt: new Date().toISOString(),
      user: {
        id: `user-${Date.now()}`,
        name: email.split('@')[0],
        email,
        role: 'USER',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    };
    trip.members.push(member);
    return member;
  }
  return request<TripMember>({
    method: 'POST',
    url: `/trips/${tripId}/members`,
    data: { email, role },
  });
}

export async function removeTripMember(tripId: string, memberId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (trip) trip.members = trip.members.filter((m) => m.id !== memberId);
    return;
  }
  await request<void>({ method: 'DELETE', url: `/trips/${tripId}/members/${memberId}` });
}

export async function createShareLink(
  tripId: string,
  input: CreateShareInput,
): Promise<ShareLink> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    const slug = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const share: ShareLink = {
      id: `share-${Date.now()}`,
      slug,
      url: `${window.location.origin}/public/${slug}`,
      allowCopy: input.allowCopy ?? true,
      isActive: true,
      viewCount: 0,
      copyCount: 0,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
      createdAt: new Date().toISOString(),
    };
    trip.shares.push(share);
    trip.isPublic = true;
    return share;
  }
  return request<ShareLink>({ method: 'POST', url: `/trips/${tripId}/share`, data: input });
}

export async function listShareLinks(tripId: string): Promise<ShareLink[]> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    return trip.shares;
  }
  return request<ShareLink[]>({ method: 'GET', url: `/trips/${tripId}/share` });
}

export async function revokeShareLink(tripId: string, shareId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (trip) {
      const share = trip.shares.find((s) => s.id === shareId);
      if (share) share.isActive = false;
      if (!trip.shares.some((s) => s.isActive)) trip.isPublic = false;
    }
    return;
  }
  await request<void>({ method: 'DELETE', url: `/trips/${tripId}/share/${shareId}` });
}

export async function createStop(tripId: string, input: CreateStopInput): Promise<Stop> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    const city = trip.stops.find((s) => s.city.id === input.cityId)?.city;
    if (!city) throw new Error('City not found');
    const stop: Stop = {
      id: `stop-${Date.now()}`,
      tripId,
      sequence: input.sequence ?? trip.stops.length,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      days: 0,
      nights: 0,
      notes: input.notes ?? null,
      accommodationCost: input.accommodationCost ?? 0,
      transportCost: input.transportCost ?? 0,
      mealsPerDayCost: input.mealsPerDayCost ?? 0,
      city,
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    trip.stops.push(stop);
    computeBudget(trip);
    return stop;
  }
  return request<Stop>({ method: 'POST', url: `/trips/${tripId}/stops`, data: input });
}
