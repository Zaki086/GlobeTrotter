import { z } from 'zod';
import { uuid } from './common.validator';

export const createShareSchema = z.object({
  /** Let viewers clone the itinerary into their own account. */
  allowCopy: z.boolean().default(true),
  /** Optional link lifetime in days; omit for a link that never expires. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const shareSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(8, 'Invalid share link')
    .max(80, 'Invalid share link')
    // Matches buildShareSlug output: lowercase words plus the random suffix.
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid share link'),
});

export const copyTripSchema = z.object({
  /** Rename on copy; defaults to "<original name> (copy)". */
  name: z.string().trim().min(2).max(160).optional(),
  /**
   * Shift the copied itinerary to start on this date, preserving the gaps
   * between stops. Omit to keep the original dates.
   */
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
    .optional(),
});

export const shareIdParamSchema = z.object({ id: uuid, shareId: uuid });

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type CopyTripInput = z.infer<typeof copyTripSchema>;
