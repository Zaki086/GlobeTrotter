import { z } from 'zod';
import { TripStatus } from '@prisma/client';
import {
  currencyCode,
  httpUrl,
  isoDate,
  money,
  pagination,
  uuid,
} from './common.validator';

const tripName = z.string().trim().min(2, 'Trip name is too short').max(160, 'Trip name is too long');
const tripDescription = z.string().trim().max(5000, 'Description is too long');

export const createTripSchema = z
  .object({
    name: tripName,
    description: tripDescription.optional(),
    coverImageUrl: httpUrl.optional(),
    startDate: isoDate,
    endDate: isoDate,
    travelers: z.number().int().min(1, 'A trip needs at least one traveler').max(50).default(1),
    currency: currencyCode.default('USD'),
    status: z.nativeEnum(TripStatus).default(TripStatus.PLANNED),
    /** Optional budget ceiling captured at creation time. */
    plannedTotal: money.optional(),
  })
  .refine((data) => Date.parse(data.endDate) >= Date.parse(data.startDate), {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
  .refine(
    (data) => (Date.parse(data.endDate) - Date.parse(data.startDate)) / 86_400_000 <= 730,
    { message: 'A trip may not span more than 730 days', path: ['endDate'] },
  );

export const updateTripSchema = z
  .object({
    name: tripName.optional(),
    description: tripDescription.nullable().optional(),
    coverImageUrl: httpUrl.nullable().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    travelers: z.number().int().min(1).max(50).optional(),
    currency: currencyCode.optional(),
    status: z.nativeEnum(TripStatus).optional(),
    plannedTotal: money.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  // Only checkable here when both dates are sent together; TripService
  // re-validates against the stored dates for single-sided updates.
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      Date.parse(data.endDate) >= Date.parse(data.startDate),
    { message: 'End date must be on or after the start date', path: ['endDate'] },
  );

export const listTripsQuerySchema = pagination.extend({
  search: z.string().trim().max(160).optional(),
  status: z.nativeEnum(TripStatus).optional(),
  /** Server-side buckets so the client does not have to filter by date. */
  filter: z.enum(['all', 'upcoming', 'ongoing', 'past']).default('all'),
  sortBy: z.enum(['startDate', 'createdAt', 'name']).default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const tripIdParamSchema = z.object({ id: uuid });

export const itineraryQuerySchema = z.object({
  /** "timeline" groups by day; "list" groups by city/stop. */
  view: z.enum(['timeline', 'list']).default('timeline'),
});

export const calendarQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email('Must be a valid email address').toLowerCase(),
  role: z.enum(['EDITOR', 'VIEWER']).default('VIEWER'),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
