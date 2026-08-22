import type { Request } from 'express';
import { buildPaginationMeta, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { resolvePagination } from '../utils/pagination';
import { toUtcDate } from '../utils/dates';
import type { RequestContext } from '../types';
import { AdminService } from '../services/admin.service';
import { AuditService } from '../services/audit.service';
import type { AnalyticsQuery, ListUsersQuery } from '../validators/admin.validator';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await AdminService.analytics(
    req.query as never as AnalyticsQuery,
    req.auth!.userId,
    contextOf(req),
  );
  return sendSuccess(res, analytics, 'Analytics retrieved');
});

export const listUsers = asyncHandler(async (req, res) => {
  const query = req.query as never as ListUsersQuery;
  const { items, total } = await AdminService.listUsers(query);
  return sendSuccess(
    res,
    items,
    'Users retrieved',
    200,
    buildPaginationMeta(query.page, query.limit, total),
  );
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await AdminService.getUser(req.params.userId);
  return sendSuccess(res, user, 'User retrieved');
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await AdminService.updateUser(
    req.params.userId,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendSuccess(res, user, 'User updated successfully');
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.query as Record<string, never>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
  });

  const { items, total } = await AuditService.list({
    skip,
    take,
    action: query.action,
    actorId: query.actorId,
    resourceType: query.resourceType,
    from: query.from ? toUtcDate(query.from) : undefined,
    to: query.to ? toUtcDate(query.to) : undefined,
  });

  return sendSuccess(res, items, 'Audit logs retrieved', 200, buildPaginationMeta(page, limit, total));
});
