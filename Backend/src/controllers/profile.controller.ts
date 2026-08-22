import type { Request } from 'express';
import { buildPaginationMeta, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { resolvePagination } from '../utils/pagination';
import type { RequestContext } from '../types';
import { ProfileService } from '../services/profile.service';
import { NotificationService } from '../services/notification.service';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await ProfileService.get(req.auth!.userId);
  return sendSuccess(res, profile, 'Profile retrieved');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await ProfileService.update(req.auth!.userId, req.body, contextOf(req));
  return sendSuccess(res, profile, 'Profile updated successfully');
});

export const deleteProfile = asyncHandler(async (req, res) => {
  await ProfileService.remove(req.auth!.userId, req.body.password, contextOf(req));
  res.clearCookie('gt_refresh_token', { path: '/' });
  return sendSuccess(res, {}, 'Account deleted permanently');
});

export const addSavedDestination = asyncHandler(async (req, res) => {
  const profile = await ProfileService.addSavedDestination(req.auth!.userId, req.params.cityId);
  return sendSuccess(res, profile, 'Destination saved');
});

export const removeSavedDestination = asyncHandler(async (req, res) => {
  const profile = await ProfileService.removeSavedDestination(req.auth!.userId, req.params.cityId);
  return sendSuccess(res, profile, 'Destination removed from saved list');
});

export const listNotifications = asyncHandler(async (req, res) => {
  const query = req.query as Record<string, never>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
  });

  const { items, total, unreadCount } = await NotificationService.list(req.auth!.userId, {
    skip,
    take,
    unreadOnly: Boolean(query.unreadOnly),
  });

  return sendSuccess(
    res,
    { items, unreadCount },
    'Notifications retrieved',
    200,
    buildPaginationMeta(page, limit, total),
  );
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markRead(req.auth!.userId, req.params.id);
  return sendSuccess(res, result, 'Notification marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllRead(req.auth!.userId);
  return sendSuccess(res, result, 'All notifications marked as read');
});
