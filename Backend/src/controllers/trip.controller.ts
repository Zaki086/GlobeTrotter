import type { Request } from 'express';
import { buildPaginationMeta, sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { RequestContext } from '../types';
import { TripService } from '../services/trip.service';
import { ItineraryService } from '../services/itinerary.service';
import { StopService } from '../services/stop.service';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const createTrip = asyncHandler(async (req, res) => {
  const trip = await TripService.create(req.auth!.userId, req.body, contextOf(req));
  return sendCreated(res, trip, 'Trip created successfully');
});

export const listTrips = asyncHandler(async (req, res) => {
  const query = req.query as never as Parameters<typeof TripService.list>[1];
  const { items, total } = await TripService.list(req.auth!.userId, query);
  return sendSuccess(
    res,
    items,
    'Trips retrieved',
    200,
    buildPaginationMeta(query.page, query.limit, total),
  );
});

export const getTrip = asyncHandler(async (req, res) => {
  const trip = await TripService.getById(req.params.id, req.auth!.userId);
  return sendSuccess(res, trip, 'Trip retrieved');
});

export const updateTrip = asyncHandler(async (req, res) => {
  const trip = await TripService.update(req.params.id, req.auth!.userId, req.body, contextOf(req));
  return sendSuccess(res, trip, 'Trip updated successfully');
});

export const deleteTrip = asyncHandler(async (req, res) => {
  await TripService.remove(req.params.id, req.auth!.userId, contextOf(req));
  return sendSuccess(res, {}, 'Trip deleted successfully');
});

export const getItinerary = asyncHandler(async (req, res) => {
  const view = (req.query.view as 'timeline' | 'list') ?? 'timeline';
  const itinerary = await ItineraryService.getForTrip(req.params.id, req.auth!.userId, view);
  return sendSuccess(res, itinerary, 'Itinerary retrieved');
});

export const getCalendar = asyncHandler(async (req, res) => {
  const calendar = await ItineraryService.getCalendar(req.params.id, req.auth!.userId, {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  return sendSuccess(res, calendar, 'Trip calendar retrieved');
});

export const listTripStops = asyncHandler(async (req, res) => {
  const stops = await StopService.listForTrip(req.params.id, req.auth!.userId);
  return sendSuccess(res, stops, 'Stops retrieved');
});

export const addTripMember = asyncHandler(async (req, res) => {
  const member = await TripService.addMember(
    req.params.id,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendCreated(res, member, 'Member added to trip');
});

export const removeTripMember = asyncHandler(async (req, res) => {
  await TripService.removeMember(
    req.params.id,
    req.auth!.userId,
    req.params.memberId,
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Member removed from trip');
});
