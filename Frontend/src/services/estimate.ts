import { USE_MOCK, request, delay } from '@/lib/api';
import type { ComfortTier, RouteEstimate, StopEstimate } from '@/types';

/**
 * The cost engine lives on the server so the numbers the planner shows and the
 * numbers the budget stores can never disagree.
 */
export async function estimateStop(params: {
  cityId: string;
  arrivalDate: string;
  departureDate: string;
  travelers: number;
  tier?: ComfortTier;
  fromCityId?: string;
}): Promise<StopEstimate> {
  if (USE_MOCK) {
    await delay(200);
    const nights = Math.max(
      0,
      Math.round(
        (Date.parse(params.departureDate) - Date.parse(params.arrivalDate)) / 86_400_000,
      ),
    );
    const days = nights + 1;
    const rooms = Math.max(1, Math.ceil(params.travelers / 2));
    const nightly = params.tier === 'LUXURY' ? 12000 : params.tier === 'BUDGET' ? 1400 : 3800;
    const meals = params.tier === 'LUXURY' ? 2200 : params.tier === 'BUDGET' ? 400 : 900;
    return {
      city: { id: params.cityId, name: 'City', currency: 'INR' },
      tier: params.tier ?? 'MID',
      days,
      nights,
      rooms,
      travelers: params.travelers,
      season: { label: 'Shoulder season', multiplier: 1 },
      accommodation: {
        nightlyRate: nightly,
        nights,
        rooms,
        total: nightly * nights * rooms,
        options: [
          { tier: 'BUDGET', nightlyRate: 1400, total: 1400 * nights * rooms },
          { tier: 'MID', nightlyRate: 3800, total: 3800 * nights * rooms },
          { tier: 'LUXURY', nightlyRate: 12000, total: 12000 * nights * rooms },
        ],
      },
      meals: { perPersonPerDay: meals, days, total: meals * days * params.travelers },
      transport: null,
      suggested: {
        accommodationCost: nightly * nights * rooms,
        transportCost: 0,
        mealsPerDayCost: meals,
      },
      total: nightly * nights * rooms + meals * days * params.travelers,
    };
  }

  return request<StopEstimate>({
    method: 'GET',
    url: '/estimates/stop',
    params: params as Record<string, unknown>,
  });
}

export async function estimateRoute(input: {
  cityIds: string[];
  startDate: string;
  nightsPerCity: number[];
  travelers: number;
  tier?: ComfortTier;
}): Promise<RouteEstimate> {
  return request<RouteEstimate>({ method: 'POST', url: '/estimates/route', data: input });
}
