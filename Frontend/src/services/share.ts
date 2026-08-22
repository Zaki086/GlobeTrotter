import { USE_MOCK, request, delay } from '@/lib/api';
import { getPublicItinerary, mockTrips, computeBudget } from '@/services/mock-data';
import type { CopyTripInput, PublicItinerary } from '@/types';

export async function getSharedItinerary(slug: string): Promise<PublicItinerary> {
  if (USE_MOCK) {
    await delay();
    return getPublicItinerary(slug);
  }
  return request<PublicItinerary>({ method: 'GET', url: `/public/${slug}` });
}

export async function copySharedItinerary(
  slug: string,
  input: CopyTripInput,
): Promise<{ id: string; name: string; startDate: string; endDate: string; status: string; stopCount: number; shiftedByDays: number }> {
  if (USE_MOCK) {
    await delay();
    const source = mockTrips.find((t) => t.shares.some((s) => s.slug === slug));
    if (!source) throw new Error('Itinerary not found');
    const { parseISO, format, addDays, differenceInCalendarDays } = await import('date-fns');
    const offsetDays = input.startDate ? differenceInCalendarDays(parseISO(input.startDate), parseISO(source.startDate)) : 0;
    const shift = (date: string) => format(addDays(parseISO(date), offsetDays), 'yyyy-MM-dd');
    const id = `trip-${Date.now()}`;
    const copy = {
      ...source,
      id,
      name: input.name ?? `${source.name} (copy)`,
      startDate: shift(source.startDate),
      endDate: shift(source.endDate),
      status: 'DRAFT' as const,
      isPublic: false,
      shares: [],
      stops: source.stops.map((s, i) => ({
        ...s,
        id: `stop-${id}-${i}`,
        tripId: id,
        arrivalDate: shift(s.arrivalDate),
        departureDate: shift(s.departureDate),
      })),
    };
    mockTrips.push(copy);
    computeBudget(copy);
    return {
      id: copy.id,
      name: copy.name,
      startDate: copy.startDate,
      endDate: copy.endDate,
      status: copy.status,
      stopCount: copy.stops.length,
      shiftedByDays: offsetDays,
    };
  }
  return request<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    stopCount: number;
    shiftedByDays: number;
  }>({ method: 'POST', url: `/public/${slug}/copy`, data: input });
}
