import type { Request } from 'express';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { RequestContext } from '../types';
import { StopService } from '../services/stop.service';
import { ActivityService } from '../services/activity.service';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const createStop = asyncHandler(async (req, res) => {
  const stop = await StopService.create(req.params.id, req.auth!.userId, req.body, contextOf(req));
  return sendCreated(res, stop, 'Stop added to trip');
});

export const getStop = asyncHandler(async (req, res) => {
  const stop = await StopService.getById(req.params.id, req.auth!.userId);
  return sendSuccess(res, stop, 'Stop retrieved');
});

export const updateStop = asyncHandler(async (req, res) => {
  const stop = await StopService.update(req.params.id, req.auth!.userId, req.body, contextOf(req));
  return sendSuccess(res, stop, 'Stop updated successfully');
});

export const deleteStop = asyncHandler(async (req, res) => {
  await StopService.remove(req.params.id, req.auth!.userId, contextOf(req));
  return sendSuccess(res, {}, 'Stop removed from trip');
});

/** Drag-and-drop reorder — takes the full ordered stop list for one trip. */
export const reorderStops = asyncHandler(async (req, res) => {
  const stops = await StopService.reorder(req.auth!.userId, req.body, contextOf(req));
  return sendSuccess(res, stops, 'Stops reordered successfully');
});

export const listStopActivities = asyncHandler(async (req, res) => {
  const activities = await ActivityService.listForStop(req.params.id, req.auth!.userId);
  return sendSuccess(res, activities, 'Stop activities retrieved');
});

export const addStopActivity = asyncHandler(async (req, res) => {
  const activity = await ActivityService.addToStop(
    req.params.id,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendCreated(res, activity, 'Activity added to stop');
});

export const updateStopActivity = asyncHandler(async (req, res) => {
  const activity = await ActivityService.updateStopActivity(
    req.params.id,
    req.params.activityId,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendSuccess(res, activity, 'Scheduled activity updated');
});

export const removeStopActivity = asyncHandler(async (req, res) => {
  await ActivityService.removeFromStop(
    req.params.id,
    req.params.activityId,
    req.auth!.userId,
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Activity removed from stop');
});

/**
 * Sets a stop's length in nights. The departure date and every later stop
 * shift to match, and costs are re-derived — the "stay 1 day and the
 * departure follows" behaviour.
 */
export const setStopNights = asyncHandler(async (req, res) => {
  const stops = await StopService.setNights(
    req.params.id,
    req.auth!.userId,
    req.body.nights,
    contextOf(req),
  );
  return sendSuccess(res, stops, 'Itinerary dates updated');
});
