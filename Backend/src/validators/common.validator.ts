import { z } from 'zod';
import { PAGINATION } from '../config/constants';

/**
 * Shared primitives. Every route composes its schema from these so validation
 * rules (UUID format, date format, currency casing) stay identical API-wide.
 */

/** Strict RFC-4122 UUID check — rejects "123", trailing junk, wrong version. */
export const uuid = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Must be a valid UUID',
  );

export const idParam = z.object({ id: uuid });

export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid calendar date');

export const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a time in HH:MM (24-hour) format');

/** ISO-4217 alpha code, normalized to uppercase. */
export const currencyCode = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO code')
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
  .transform((v) => v.toUpperCase());

/** BCP-47-ish language tag, normalized to lowercase. */
export const languageCode = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/, 'Must be a language code such as "en" or "en-GB"')
  .transform((v) => v.toLowerCase());

/** Rejects javascript: and other non-http schemes in user-supplied image URLs. */
export const httpUrl = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .max(2048, 'URL is too long')
  .refine(
    (value) => /^https?:\/\//i.test(value),
    'Only http(s) URLs are allowed',
  );

export const money = z
  .number({ invalid_type_error: 'Must be a number' })
  .nonnegative('Must not be negative')
  .max(99_999_999, 'Amount is too large')
  .refine((v) => Number.isFinite(v), 'Must be a finite number');

export const pagination = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

export const sortOrder = z.enum(['asc', 'desc']).default('desc');

/**
 * Emails are normalized before storage so "User@Example.com " and
 * "user@example.com" cannot become two accounts.
 */
export const email = z
  .string()
  .trim()
  .min(3, 'Email is required')
  .max(255, 'Email is too long')
  .email('Must be a valid email address')
  .transform((v) => v.toLowerCase());

/**
 * Password policy: length does most of the work, but the character-class
 * requirements are what the PRD's "strong password validation" asks for.
 */
export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character')
  .refine(
    (value) => !/(.)\1{3,}/.test(value),
    'Password must not repeat the same character four times in a row',
  );

export const personName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(120, 'Name must be at most 120 characters');

/** Validates that a range is ordered and not absurdly long. */
export function dateRangeRefinement<T extends { startDate: string; endDate: string }>(
  schema: z.ZodType<T>,
  maxDays = 730,
) {
  return schema
    .refine(
      (data) => Date.parse(data.endDate) >= Date.parse(data.startDate),
      { message: 'End date must be on or after the start date', path: ['endDate'] },
    )
    .refine(
      (data) =>
        (Date.parse(data.endDate) - Date.parse(data.startDate)) / 86_400_000 <= maxDays,
      { message: `Date range must not exceed ${maxDays} days`, path: ['endDate'] },
    );
}
