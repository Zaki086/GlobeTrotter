import { USE_MOCK, request, delay } from '@/lib/api';
import { mockTrips, getTripById, computeBudget, mockActivities, mockCities } from '@/services/mock-data';
import type {
  AddStopActivityInput,
  CreateStopInput,
  ReorderStopsInput,
  Stop,
  StopActivity,
  UpdateStopActivityInput,
  UpdateStopInput,
} from '@/types';

export async function createStop(tripId: string, input: CreateStopInput): Promise<Stop> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    const city = mockCities.find((c) => c.id === input.cityId);
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

export async function getStop(id: string): Promise<Stop> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === id);
      if (stop) return stop;
    }
    throw new Error('Stop not found');
  }
  return request<Stop>({ method: 'GET', url: `/stops/${id}` });
}

export async function updateStop(id: string, input: UpdateStopInput): Promise<Stop> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === id);
      if (stop) {
        Object.assign(stop, input, { updatedAt: new Date().toISOString() });
        computeBudget(trip);
        return stop;
      }
    }
    throw new Error('Stop not found');
  }
  return request<Stop>({ method: 'PATCH', url: `/stops/${id}`, data: input });
}

export async function deleteStop(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const idx = trip.stops.findIndex((s) => s.id === id);
      if (idx >= 0) {
        trip.stops.splice(idx, 1);
        trip.stops.forEach((s, i) => (s.sequence = i));
        computeBudget(trip);
        return;
      }
    }
    throw new Error('Stop not found');
  }
  await request<void>({ method: 'DELETE', url: `/stops/${id}` });
}

export async function reorderStops(input: ReorderStopsInput): Promise<Stop[]> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(input.tripId);
    if (!trip) throw new Error('Trip not found');
    const ordered = input.stopIds
      .map((id) => trip.stops.find((s) => s.id === id))
      .filter((s): s is Stop => !!s);
    trip.stops = ordered.map((s, i) => ({ ...s, sequence: i }));
    computeBudget(trip);
    return trip.stops;
  }
  return request<Stop[]>({ method: 'PATCH', url: '/stops/reorder', data: input });
}

export async function listStopActivities(stopId: string): Promise<StopActivity[]> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === stopId);
      if (stop) return stop.activities;
    }
    throw new Error('Stop not found');
  }
  return request<StopActivity[]>({ method: 'GET', url: `/stops/${stopId}/activities` });
}

export async function addStopActivity(
  stopId: string,
  input: AddStopActivityInput,
): Promise<StopActivity> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === stopId);
      if (stop) {
        const activity = mockActivities.find((a) => a.id === input.activityId);
        if (!activity) throw new Error('Activity not found');
        const scheduled: StopActivity = {
          id: `sa-${Date.now()}`,
          activityId: activity.id,
          name: activity.name,
          type: activity.type,
          description: activity.description,
          imageUrl: activity.imageUrl,
          scheduledDate: input.scheduledDate ?? null,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          sequence: input.sequence ?? stop.activities.length,
          cost: input.costOverride ?? activity.estimatedCost,
          currency: activity.currency,
          durationMinutes: input.durationOverride ?? activity.durationMinutes,
          notes: input.notes ?? null,
        };
        stop.activities.push(scheduled);
        computeBudget(trip);
        return scheduled;
      }
    }
    throw new Error('Stop not found');
  }
  return request<StopActivity>({
    method: 'POST',
    url: `/stops/${stopId}/activities`,
    data: input,
  });
}

export async function updateStopActivity(
  stopId: string,
  activityId: string,
  input: UpdateStopActivityInput,
): Promise<StopActivity> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === stopId);
      const activity = stop?.activities.find((a) => a.activityId === activityId);
      if (activity && stop) {
        Object.assign(activity, input);
        computeBudget(trip);
        return activity;
      }
    }
    throw new Error('Activity not found');
  }
  return request<StopActivity>({
    method: 'PATCH',
    url: `/stops/${stopId}/activities/${activityId}`,
    data: input,
  });
}

export async function removeStopActivity(stopId: string, activityId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    for (const trip of mockTrips) {
      const stop = trip.stops.find((s) => s.id === stopId);
      if (stop) {
        stop.activities = stop.activities.filter((a) => a.activityId !== activityId);
        computeBudget(trip);
        return;
      }
    }
    throw new Error('Stop not found');
  }
  await request<void>({ method: 'DELETE', url: `/stops/${stopId}/activities/${activityId}` });
}
