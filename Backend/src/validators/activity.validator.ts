import { z } from 'zod';
import { ActivityType } from '@prisma/client';
import { isoDate, money, pagination, timeOfDay, uuid } from './common.validator';

export const listActivitiesQuerySchema = pagination.extend({
  search: z.string().trim().max(160).optional(),
  cityId: uuid.optional(),
  type: z.nativeEnum(ActivityType).optional(),
  minCost: z.coerce.number().min(0).optional(),
  maxCost: z.coerce.number().min(0).optional(),
  maxDuration: z.coerce.number().int().min(1).max(10080).optional(),
  sortBy: z.enum(['popularity', 'name', 'estimatedCost', 'durationMinutes']).default('popularity'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Scheduling a catalog activity into a stop. Every cost/duration field is an
 * override — the catalog row itself is never mutated by a trip.
 */
export const addStopActivitySchema = z
  .object({
    activityId: uuid,
    scheduledDate: isoDate.optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    sequence: z.number().int().min(0).optional(),
    costOverride: money.optional(),
    durationOverride: z.number().int().min(1).max(10080).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
    { message: 'End time must be after the start time', path: ['endTime'] },
  );

export const updateStopActivitySchema = z
  .object({
    scheduledDate: isoDate.nullable().optional(),
    startTime: timeOfDay.nullable().optional(),
    endTime: timeOfDay.nullable().optional(),
    sequence: z.number().int().min(0).optional(),
    costOverride: money.nullable().optional(),
    durationOverride: z.number().int().min(1).max(10080).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const stopActivityParamsSchema = z.object({
  id: uuid,
  activityId: uuid,
});

export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
export type AddStopActivityInput = z.infer<typeof addStopActivitySchema>;
