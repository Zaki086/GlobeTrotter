import { z } from 'zod';
import {
  currencyCode,
  httpUrl,
  languageCode,
  pagination,
  personName,
  uuid,
} from './common.validator';

export const updateProfileSchema = z
  .object({
    name: personName.optional(),
    avatarUrl: httpUrl.nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    language: languageCode.optional(),
    currency: currencyCode.optional(),
    country: z.string().trim().max(80).nullable().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,30}$/, 'Must be a valid phone number')
      .nullable()
      .optional(),
    /** Full replacement of the saved-destinations list (city ids). */
    savedDestinations: z.array(uuid).max(200, 'Too many saved destinations').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const savedDestinationParamSchema = z.object({ cityId: uuid });

/**
 * Account deletion is irreversible and cascades to every trip, so it requires
 * the current password plus a typed confirmation.
 */
export const deleteProfileSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required'),
  confirm: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm account deletion' }),
  }),
});

export const listNotificationsQuerySchema = pagination.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteProfileInput = z.infer<typeof deleteProfileSchema>;
