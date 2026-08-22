import { z } from 'zod';
import { isoDate, money, uuid } from './common.validator';

export const createStopSchema = z
  .object({
    cityId: uuid,
    arrivalDate: isoDate,
    departureDate: isoDate,
    /** Omit to append to the end of the itinerary. */
    sequence: z.number().int().min(0).optional(),
    notes: z.string().trim().max(2000).optional(),
    accommodationCost: money.default(0),
    transportCost: money.default(0),
    mealsPerDayCost: money.default(0),
  })
  .refine((data) => Date.parse(data.departureDate) >= Date.parse(data.arrivalDate), {
    message: 'Departure date must be on or after the arrival date',
    path: ['departureDate'],
  });

export const updateStopSchema = z
  .object({
    cityId: uuid.optional(),
    arrivalDate: isoDate.optional(),
    departureDate: isoDate.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    accommodationCost: money.optional(),
    transportCost: money.optional(),
    mealsPerDayCost: money.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (data) =>
      !data.arrivalDate ||
      !data.departureDate ||
      Date.parse(data.departureDate) >= Date.parse(data.arrivalDate),
    { message: 'Departure date must be on or after the arrival date', path: ['departureDate'] },
  );

/**
 * Drag-and-drop reorder. The client sends the full ordered list of stop ids
 * for one trip; the service verifies the set matches exactly, which makes the
 * operation idempotent and impossible to apply to a stale partial list.
 */
export const reorderStopsSchema = z.object({
  tripId: uuid,
  stopIds: z
    .array(uuid)
    .min(1, 'At least one stop id is required')
    .max(200, 'Too many stops')
    .refine((ids) => new Set(ids).size === ids.length, 'Stop ids must be unique'),
  /** When true, arrival/departure dates are recomputed to follow the new order. */
  shiftDates: z.boolean().default(false),
});

export const stopIdParamSchema = z.object({ id: uuid });

export type CreateStopInput = z.infer<typeof createStopSchema>;
export type UpdateStopInput = z.infer<typeof updateStopSchema>;
export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>;
