import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { inclusiveDayCount, toUtcDate } from '../utils/dates';

/**
 * The cost engine.
 *
 * Everything a traveller would otherwise have to type — what a night costs,
 * what the food will run to, what it takes to get from one city to the next —
 * is derived here from the destination's own rate band, the number of nights,
 * the party size and the time of year.
 *
 * The rates are seeded per city from real market bands rather than fetched
 * live: live inventory pricing needs a commercial provider (Amadeus, Booking,
 * RateHawk) and an API key. `estimateStay` is the single seam where such a
 * provider would slot in — everything downstream consumes its output.
 */

export type ComfortTier = 'BUDGET' | 'MID' | 'LUXURY';
export type TransportMode = 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR';

/** Great-circle distance in km. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * India's travel seasons.
 *
 * Peak months are per-city (Ladakh peaks in summer, Rajasthan in winter), so
 * the multiplier keys off the city's own `peakMonths`. The monsoon discount
 * applies nationally — July and August are genuinely cheaper almost everywhere
 * except the Himalayan rain-shadow.
 */
export function seasonMultiplier(month: number, peakMonths: number[]): {
  multiplier: number;
  label: string;
} {
  if (peakMonths.includes(month)) return { multiplier: 1.35, label: 'Peak season' };
  if (month === 7 || month === 8) return { multiplier: 0.75, label: 'Monsoon — low season' };
  return { multiplier: 1, label: 'Shoulder season' };
}

/**
 * How people actually cover a given distance in India, and roughly what it
 * costs per person one way. Short hops are road; the sleeper-train band is
 * where most intercity travel sits; flights only make sense past ~700km.
 */
export function suggestTransport(distanceKm: number): {
  mode: TransportMode;
  costPerPerson: number;
  durationHours: number;
  note: string;
} {
  if (distanceKm <= 30) {
    return {
      mode: 'CAR',
      costPerPerson: Math.max(150, Math.round(distanceKm * 18)),
      durationHours: Math.max(0.5, distanceKm / 30),
      note: 'Local taxi or auto',
    };
  }
  if (distanceKm <= 250) {
    return {
      mode: 'CAR',
      costPerPerson: Math.round(distanceKm * 12),
      durationHours: distanceKm / 45,
      note: 'Road transfer — usually faster than the train at this range',
    };
  }
  if (distanceKm <= 700) {
    return {
      mode: 'TRAIN',
      costPerPerson: Math.round(600 + distanceKm * 2.2),
      durationHours: distanceKm / 55,
      note: 'Sleeper or AC chair car',
    };
  }
  return {
    mode: 'FLIGHT',
    costPerPerson: Math.round(2800 + distanceKm * 3.4),
    durationHours: distanceKm / 700 + 2.5,
    note: 'Domestic flight, including airport transfers',
  };
}

function rateFor(
  city: { stayBudget: number; stayMid: number; stayLuxury: number },
  tier: ComfortTier,
): number {
  return tier === 'BUDGET' ? city.stayBudget : tier === 'LUXURY' ? city.stayLuxury : city.stayMid;
}

function mealRateFor(
  city: { mealBudget: number; mealMid: number; mealLuxury: number },
  tier: ComfortTier,
): number {
  return tier === 'BUDGET' ? city.mealBudget : tier === 'LUXURY' ? city.mealLuxury : city.mealMid;
}

/** Two travellers share a room; four need two. */
function roomsFor(travelers: number): number {
  return Math.max(1, Math.ceil(travelers / 2));
}

export class EstimateService {
  /**
   * What a stay in one city costs, given dates, party size and comfort level.
   * Returns every component so the UI can show its working rather than just a
   * number the user has to trust.
   */
  static async estimateStop(params: {
    cityId: string;
    arrivalDate: string;
    departureDate: string;
    travelers: number;
    tier?: ComfortTier;
    /** Previous stop, if any — used to price the leg into this city. */
    fromCityId?: string;
  }) {
    const tier: ComfortTier = params.tier ?? 'MID';

    const city = await prisma.city.findUnique({ where: { id: params.cityId } });
    if (!city) throw ApiError.badRequest('That city does not exist');

    const arrival = toUtcDate(params.arrivalDate);
    const departure = toUtcDate(params.departureDate);
    if (departure < arrival) {
      throw ApiError.validation([
        { field: 'departureDate', message: 'Departure must be on or after arrival' },
      ]);
    }

    const days = inclusiveDayCount(arrival, departure);
    // You pay for nights, not days — a same-day visit has no room cost.
    const nights = Math.max(0, days - 1);
    const rooms = roomsFor(params.travelers);

    const season = seasonMultiplier(arrival.getUTCMonth() + 1, city.peakMonths);

    const nightlyRate = Math.round(rateFor(city, tier) * season.multiplier);
    const accommodationCost = nightlyRate * nights * rooms;

    const mealsPerDayCost = Math.round(mealRateFor(city, tier) * season.multiplier);
    const mealsTotal = mealsPerDayCost * days * params.travelers;

    // Cost of getting *to* this city from the previous stop.
    let transport: {
      fromCity: string;
      distanceKm: number;
      mode: TransportMode;
      durationHours: number;
      costPerPerson: number;
      total: number;
      note: string;
    } | null = null;

    if (params.fromCityId && params.fromCityId !== params.cityId) {
      const origin = await prisma.city.findUnique({
        where: { id: params.fromCityId },
        select: { name: true, latitude: true, longitude: true },
      });

      if (origin) {
        const distanceKm = haversineKm(
          { latitude: Number(origin.latitude), longitude: Number(origin.longitude) },
          { latitude: Number(city.latitude), longitude: Number(city.longitude) },
        );
        const leg = suggestTransport(distanceKm);
        transport = {
          fromCity: origin.name,
          distanceKm,
          mode: leg.mode,
          durationHours: Math.round(leg.durationHours * 10) / 10,
          costPerPerson: leg.costPerPerson,
          total: leg.costPerPerson * params.travelers,
          note: leg.note,
        };
      }
    }

    const transportCost = transport?.total ?? 0;

    return {
      city: { id: city.id, name: city.name, currency: city.currency },
      tier,
      days,
      nights,
      rooms,
      travelers: params.travelers,
      season: { label: season.label, multiplier: season.multiplier },

      accommodation: {
        nightlyRate,
        nights,
        rooms,
        total: accommodationCost,
        // What the other tiers would cost, so the picker can show the trade-off.
        options: (['BUDGET', 'MID', 'LUXURY'] as ComfortTier[]).map((t) => ({
          tier: t,
          nightlyRate: Math.round(rateFor(city, t) * season.multiplier),
          total: Math.round(rateFor(city, t) * season.multiplier) * nights * rooms,
        })),
      },

      meals: { perPersonPerDay: mealsPerDayCost, days, total: mealsTotal },
      transport,

      // The three figures a Stop actually stores.
      suggested: {
        accommodationCost,
        transportCost,
        mealsPerDayCost,
      },
      total: accommodationCost + transportCost + mealsTotal,
    };
  }

  /**
   * Prices a whole prospective route in one call — used by the trip planner
   * to show what an itinerary will cost before any of it is saved.
   */
  static async estimateRoute(params: {
    cityIds: string[];
    startDate: string;
    nightsPerCity: number[];
    travelers: number;
    tier?: ComfortTier;
  }) {
    if (params.cityIds.length === 0) throw ApiError.badRequest('Pick at least one city');
    if (params.cityIds.length !== params.nightsPerCity.length) {
      throw ApiError.badRequest('Provide a night count for every city');
    }

    const legs = [];
    let cursor = toUtcDate(params.startDate);
    let runningTotal = 0;

    for (const [index, cityId] of params.cityIds.entries()) {
      const nights = Math.max(1, params.nightsPerCity[index]);
      const departure = new Date(cursor.getTime() + nights * 86_400_000);

      const estimate = await this.estimateStop({
        cityId,
        arrivalDate: cursor.toISOString().slice(0, 10),
        departureDate: departure.toISOString().slice(0, 10),
        travelers: params.travelers,
        tier: params.tier,
        fromCityId: index > 0 ? params.cityIds[index - 1] : undefined,
      });

      legs.push({
        ...estimate,
        arrivalDate: cursor.toISOString().slice(0, 10),
        departureDate: departure.toISOString().slice(0, 10),
      });

      runningTotal += estimate.total;
      // The next city starts the day this one ends.
      cursor = departure;
    }

    const totalDays = inclusiveDayCount(toUtcDate(params.startDate), cursor);

    return {
      startDate: params.startDate,
      endDate: cursor.toISOString().slice(0, 10),
      totalDays,
      travelers: params.travelers,
      tier: params.tier ?? 'MID',
      legs,
      total: runningTotal,
      perPerson: Math.round(runningTotal / Math.max(1, params.travelers)),
      perDay: Math.round(runningTotal / Math.max(1, totalDays)),
    };
  }
}

export default EstimateService;
