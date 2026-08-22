import type { Request } from 'express';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import type { RequestContext } from '../types';
import { ShareService } from '../services/share.service';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const createShareLink = asyncHandler(async (req, res) => {
  const share = await ShareService.createShareLink(
    req.params.id,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendCreated(res, share, 'Share link created');
});

export const listShareLinks = asyncHandler(async (req, res) => {
  const shares = await ShareService.listShareLinks(req.params.id, req.auth!.userId);
  return sendSuccess(res, shares, 'Share links retrieved');
});

export const revokeShareLink = asyncHandler(async (req, res) => {
  await ShareService.revokeShareLink(
    req.params.id,
    req.params.shareId,
    req.auth!.userId,
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Share link revoked');
});

/** Public, unauthenticated, read-only. */
export const getPublicItinerary = asyncHandler(async (req, res) => {
  const itinerary = await ShareService.getPublicItinerary(req.params.slug);
  return sendSuccess(res, itinerary, 'Shared itinerary retrieved');
});

/** Copying writes into an account, so this one does require authentication. */
export const copyPublicItinerary = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw ApiError.unauthorized('Sign in to copy this itinerary into your trips');
  }

  const trip = await ShareService.copyPublicItinerary(
    req.params.slug,
    req.auth.userId,
    req.body,
    contextOf(req),
  );
  return sendCreated(res, trip, 'Itinerary copied to your trips');
});
