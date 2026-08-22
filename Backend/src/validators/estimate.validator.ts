import { z } from 'zod';
import { isoDate, uuid } from './common.validator';

export const comfortTier = z.enum(['BUDGET', 'MID', 'LUXURY']);

export const estimateStopSchema = z.object({
  cityId: uuid,
  arrivalDate: isoDate,
  departureDate: isoDate,
  travelers: z.coerce.number().int().min(1).max(50).default(1),
  tier: comfortTier.default('MID'),
  /** Previous stop's city, so the leg into this one can be priced. */
  fromCityId: uuid.optional(),
});

export const estimateRouteSchema = z.object({
  cityIds: z.array(uuid).min(1, 'Pick at least one city').max(20),
  startDate: isoDate,
  nightsPerCity: z.array(z.number().int().min(0).max(60)).min(1).max(20),
  travelers: z.number().int().min(1).max(50).default(1),
  tier: comfortTier.default('MID'),
});

export const setNightsSchema = z.object({
  nights: z.number().int().min(0, 'Nights cannot be negative').max(60, 'That is a long stay'),
});

export type EstimateStopQuery = z.infer<typeof estimateStopSchema>;
export type EstimateRouteInput = z.infer<typeof estimateRouteSchema>;
