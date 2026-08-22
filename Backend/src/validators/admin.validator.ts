import { z } from 'zod';
import { Role } from '@prisma/client';
import { isoDate, pagination, uuid } from './common.validator';

export const analyticsQuerySchema = z.object({
  /** Window for growth + engagement series. */
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const listUsersQuerySchema = pagination.extend({
  search: z.string().trim().max(160).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: z.enum(['createdAt', 'lastLoginAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateUserSchema = z
  .object({
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const userIdParamSchema = z.object({ userId: uuid });

export const listAuditLogsQuerySchema = pagination.extend({
  action: z.string().trim().max(80).optional(),
  actorId: uuid.optional(),
  resourceType: z.string().trim().max(60).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
