import { z } from 'zod';
import { pagination, uuid } from './common.validator';

export const listCitiesQuerySchema = pagination.extend({
  search: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(60).optional(),
  /** Inclusive bounds on the 0-100 relative cost index. */
  minCostIndex: z.coerce.number().int().min(0).max(100).optional(),
  maxCostIndex: z.coerce.number().int().min(0).max(100).optional(),
  sortBy: z.enum(['popularity', 'name', 'costIndex']).default('popularity'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const cityIdParamSchema = z.object({ id: uuid });

export type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;
