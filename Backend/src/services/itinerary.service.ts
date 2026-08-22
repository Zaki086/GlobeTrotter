import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { toAmount, toDecimal } from '../utils/money';
import {
  enumerateDates,
  inclusiveDayCount,
  isWithinRange,
  minutesToTime,
  timeToMinutes,
  toDateString,
  toUtcDate,
} from '../utils/dates';
import { TripService } from './trip.service';

export interface ItineraryActivityBlock {
  id: string;
  activityId: string;
  name: string;
  type: string;
  description: string | null;
  imageUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  cost: number;
  notes: string | null;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  weekday: string;
  city: { id: string; name: string; country: string; imageUrl: string | null } | null;
  stopId: string | null;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  activities: ItineraryActivityBlock[];
  dayCost: number;
  totalMinutes: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const itinerarySelect = {
  id: true,
  name: true,
  description: true,
  coverImageUrl: true,
  startDate: true,
  endDate: true,
  travelers: true,
  currency: true,
  status: true,
  owner: { select: { id: true, name: true } },
  stops: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      sequence: true,
      arrivalDate: true,
      departureDate: true,
      notes: true,
      accommodationCost: true,
      transportCost: true,
      mealsPerDayCost: true,
      city: {
        select: {
          id: true,
          name: true,
          country: true,
          countryCode: true,
          imageUrl: true,
          timezone: true,
          latitude: true,
          longitude: true,
        },
      },
      activities: {
        orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
        select: {
          id: true,
          activityId: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          sequence: true,
          costOverride: true,
          durationOverride: true,
          notes: true,
          activity: {
            select: {
              name: true,
              type: true,
              description: true,
              imageUrl: true,
              estimatedCost: true,
              durationMinutes: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TripSelect;

type ItineraryTrip = Prisma.TripGetPayload<{ select: typeof itinerarySelect }>;

/**
 * Assembles the day-wise itinerary the PRD's "Itinerary View" screen needs,
 * in both supported shapes:
 *   - timeline: one entry per calendar day of the trip
 *   - list:     grouped by stop/city
 *
 * The same builder feeds the public share page, so a viewer with no account
 * sees exactly the structure the owner does.
 */
export class ItineraryService {
  static async getForTrip(tripId: string, userId: string, view: 'timeline' | 'list' = 'timeline') {
    await TripService.resolveAccess(tripId, userId, 'view');
    return this.build(tripId, view);
  }

  static async build(tripId: string, view: 'timeline' | 'list' = 'timeline') {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: itinerarySelect,
    });
    if (!trip) throw ApiError.notFound('Trip not found');

    const days = this.buildDays(trip);
    const byCity = this.buildByCity(trip);

    const totalActivities = trip.stops.reduce((n, s) => n + s.activities.length, 0);
    const totalCost = days.reduce((acc, d) => acc + d.dayCost, 0);

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        coverImageUrl: trip.coverImageUrl,
        startDate: toDateString(trip.startDate),
        endDate: toDateString(trip.endDate),
        durationDays: inclusiveDayCount(trip.startDate, trip.endDate),
        travelers: trip.travelers,
        currency: trip.currency,
        status: trip.status,
        owner: trip.owner,
      },
      view,
      summary: {
        totalDays: days.length,
        totalStops: trip.stops.length,
        totalActivities,
        totalCities: new Set(trip.stops.map((s) => s.city.id)).size,
        countries: [...new Set(trip.stops.map((s) => s.city.country))],
        activitiesCost: Number(totalCost.toFixed(2)),
      },
      // Both shapes are always returned; `view` tells the client which to
      // render by default, so toggling calendar/list needs no second request.
      timeline: days,
      list: byCity,
    };
  }

  // -------------------------------------------------------------------------
  // Timeline (day-wise)
  // -------------------------------------------------------------------------

  private static buildDays(trip: ItineraryTrip): ItineraryDay[] {
    const dates = enumerateDates(trip.startDate, trip.endDate);

    return dates.map((date, index) => {
      // On a transfer day two stops share the date — the one you leave and the
      // one you arrive at. Both must contribute activities, otherwise the
      // arriving stop's plans silently vanish from the timeline and the day
      // costs disagree with the budget.
      const covering = trip.stops.filter((s) => isWithinRange(date, s.arrivalDate, s.departureDate));

      // The day is labelled with the city you end it in, so a transfer day
      // reads as "you are now in X".
      const stop =
        covering.find((s) => toDateString(s.arrivalDate) === date) ?? covering[0] ?? null;

      const activities: ItineraryActivityBlock[] = [];

      for (const current of covering) {
        for (const sa of current.activities) {
          const scheduled = sa.scheduledDate ? toDateString(sa.scheduledDate) : null;
          // Unscheduled activities surface on their stop's arrival day so they
          // are never invisible in the timeline.
          const effectiveDate = scheduled ?? toDateString(current.arrivalDate);
          if (effectiveDate !== date) continue;

          activities.push({
            id: sa.id,
            activityId: sa.activityId,
            name: sa.activity.name,
            type: sa.activity.type,
            description: sa.activity.description,
            imageUrl: sa.activity.imageUrl,
            startTime: sa.startTime,
            endTime: sa.endTime,
            durationMinutes: sa.durationOverride ?? sa.activity.durationMinutes,
            cost: toAmount(sa.costOverride ?? sa.activity.estimatedCost),
            notes: sa.notes,
          });
        }
      }

      // Timed blocks first in clock order, untimed ones after.
      activities.sort((a, b) => {
        const am = timeToMinutes(a.startTime);
        const bm = timeToMinutes(b.startTime);
        if (am === null && bm === null) return 0;
        if (am === null) return 1;
        if (bm === null) return -1;
        return am - bm;
      });

      const dayCost = activities.reduce((acc, a) => acc + a.cost, 0) * trip.travelers;
      const totalMinutes = activities.reduce((acc, a) => acc + a.durationMinutes, 0);

      return {
        date,
        dayNumber: index + 1,
        weekday: WEEKDAYS[toUtcDate(date).getUTCDay()],
        city: stop
          ? {
              id: stop.city.id,
              name: stop.city.name,
              country: stop.city.country,
              imageUrl: stop.city.imageUrl,
            }
          : null,
        stopId: stop?.id ?? null,
        // A transfer day is both — you leave one city and arrive in the next.
        isArrivalDay: covering.some((s) => toDateString(s.arrivalDate) === date),
        isDepartureDay: covering.some((s) => toDateString(s.departureDate) === date),
        activities,
        dayCost: Number(dayCost.toFixed(2)),
        totalMinutes,
      };
    });
  }

  // -------------------------------------------------------------------------
  // List (grouped by city/stop)
  // -------------------------------------------------------------------------

  private static buildByCity(trip: ItineraryTrip) {
    return trip.stops.map((stop) => {
      const days = inclusiveDayCount(stop.arrivalDate, stop.departureDate);

      const activities = stop.activities.map((sa) => ({
        id: sa.id,
        activityId: sa.activityId,
        name: sa.activity.name,
        type: sa.activity.type,
        description: sa.activity.description,
        imageUrl: sa.activity.imageUrl,
        scheduledDate: sa.scheduledDate ? toDateString(sa.scheduledDate) : null,
        startTime: sa.startTime,
        endTime: sa.endTime,
        durationMinutes: sa.durationOverride ?? sa.activity.durationMinutes,
        cost: toAmount(sa.costOverride ?? sa.activity.estimatedCost),
        notes: sa.notes,
      }));

      const activitiesCost = activities.reduce(
        (acc, a) => acc.add(toDecimal(a.cost).mul(trip.travelers)),
        new Prisma.Decimal(0),
      );
      const mealsCost = toDecimal(stop.mealsPerDayCost).mul(days).mul(trip.travelers);

      return {
        stopId: stop.id,
        sequence: stop.sequence,
        arrivalDate: toDateString(stop.arrivalDate),
        departureDate: toDateString(stop.departureDate),
        days,
        nights: Math.max(0, days - 1),
        notes: stop.notes,
        city: {
          id: stop.city.id,
          name: stop.city.name,
          country: stop.city.country,
          countryCode: stop.city.countryCode,
          imageUrl: stop.city.imageUrl,
          timezone: stop.city.timezone,
          latitude: Number(stop.city.latitude),
          longitude: Number(stop.city.longitude),
        },
        activities,
        costs: {
          transport: toAmount(stop.transportCost),
          stay: toAmount(stop.accommodationCost),
          meals: toAmount(mealsCost),
          activities: toAmount(activitiesCost),
          total: toAmount(
            toDecimal(stop.transportCost)
              .add(toDecimal(stop.accommodationCost))
              .add(mealsCost)
              .add(activitiesCost),
          ),
        },
      };
    });
  }

  // -------------------------------------------------------------------------
  // Calendar
  // -------------------------------------------------------------------------

  /**
   * Calendar events grouped by date, for the trip calendar screen. Emits three
   * event kinds — travel legs, stays and activities — so the client can render
   * them with different affordances.
   */
  static async getCalendar(
    tripId: string,
    userId: string,
    range: { from?: string; to?: string } = {},
  ) {
    await TripService.resolveAccess(tripId, userId, 'view');

    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: itinerarySelect });
    if (!trip) throw ApiError.notFound('Trip not found');

    const from = range.from ? toUtcDate(range.from) : trip.startDate;
    const to = range.to ? toUtcDate(range.to) : trip.endDate;

    type CalendarEvent = {
      id: string;
      kind: 'travel' | 'stay' | 'activity';
      title: string;
      startTime: string | null;
      endTime: string | null;
      durationMinutes: number | null;
      cost: number;
      city: string | null;
      stopId: string;
      imageUrl: string | null;
      allDay: boolean;
    };

    const grouped = new Map<string, CalendarEvent[]>();
    const push = (date: string, event: CalendarEvent) => {
      if (!isWithinRange(date, from, to)) return;
      const list = grouped.get(date) ?? [];
      list.push(event);
      grouped.set(date, list);
    };

    for (const stop of trip.stops) {
      const arrival = toDateString(stop.arrivalDate);

      push(arrival, {
        id: `travel-${stop.id}`,
        kind: 'travel',
        title: `Arrive in ${stop.city.name}`,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        cost: toAmount(stop.transportCost),
        city: stop.city.name,
        stopId: stop.id,
        imageUrl: stop.city.imageUrl,
        allDay: true,
      });

      // One "stay" marker per night, so a multi-night stop paints across the
      // calendar rather than showing only on the arrival cell.
      const nights = enumerateDates(stop.arrivalDate, stop.departureDate).slice(0, -1);
      const perNight =
        nights.length > 0 ? toAmount(toDecimal(stop.accommodationCost).div(nights.length)) : 0;

      for (const night of nights) {
        push(night, {
          id: `stay-${stop.id}-${night}`,
          kind: 'stay',
          title: `Overnight in ${stop.city.name}`,
          startTime: null,
          endTime: null,
          durationMinutes: null,
          cost: perNight,
          city: stop.city.name,
          stopId: stop.id,
          imageUrl: stop.city.imageUrl,
          allDay: true,
        });
      }

      for (const sa of stop.activities) {
        const date = sa.scheduledDate ? toDateString(sa.scheduledDate) : arrival;
        const duration = sa.durationOverride ?? sa.activity.durationMinutes;
        const startMinutes = timeToMinutes(sa.startTime);

        push(date, {
          id: sa.id,
          kind: 'activity',
          title: sa.activity.name,
          startTime: sa.startTime,
          // Derive an end time from the duration when none was given.
          endTime:
            sa.endTime ?? (startMinutes !== null ? minutesToTime(startMinutes + duration) : null),
          durationMinutes: duration,
          cost: toAmount(sa.costOverride ?? sa.activity.estimatedCost),
          city: stop.city.name,
          stopId: stop.id,
          imageUrl: sa.activity.imageUrl,
          allDay: sa.startTime === null,
        });
      }
    }

    const events = enumerateDates(from, to).map((date) => {
      const dayEvents = (grouped.get(date) ?? []).sort((a, b) => {
        const order = { travel: 0, activity: 1, stay: 2 };
        const am = timeToMinutes(a.startTime);
        const bm = timeToMinutes(b.startTime);
        if (am !== null && bm !== null) return am - bm;
        if (am !== null) return -1;
        if (bm !== null) return 1;
        return order[a.kind] - order[b.kind];
      });

      return {
        date,
        weekday: WEEKDAYS[toUtcDate(date).getUTCDay()],
        eventCount: dayEvents.length,
        totalCost: Number(dayEvents.reduce((acc, e) => acc + e.cost, 0).toFixed(2)),
        events: dayEvents,
      };
    });

    return {
      tripId: trip.id,
      tripName: trip.name,
      currency: trip.currency,
      from: toDateString(from),
      to: toDateString(to),
      totalEvents: events.reduce((n, d) => n + d.eventCount, 0),
      days: events,
    };
  }
}

export default ItineraryService;
