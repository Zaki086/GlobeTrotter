import { z } from 'zod';
import { email, httpUrl, password, personName } from './common.validator';

/**
 * Registration (wireframe screen 2) collects more than a display name: first
 * and last name, phone, city and country, plus a free-text note. `name` stays
 * the canonical display field — it is composed from the two name parts when
 * they are supplied, so existing clients that only send `name` still work.
 */
export const signupSchema = z
  .object({
    name: personName.optional(),
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    email,
    password,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,30}$/, 'Must be a valid phone number')
      .optional(),
    city: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
    avatarUrl: httpUrl.optional(),
    additionalInfo: z.string().trim().max(500).optional(),
  })
  .refine((data) => !!data.name || !!(data.firstName && data.lastName), {
    message: 'Provide either a full name, or both a first and last name',
    path: ['name'],
  })
  .transform((data) => ({
    ...data,
    name: data.name ?? `${data.firstName} ${data.lastName}`.trim(),
  }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  /** Optional friendly label so users can identify sessions ("Pixel 8"). */
  deviceLabel: z.string().trim().max(120).optional(),
});

/**
 * The refresh token may arrive in the body or as an httpOnly cookie; the
 * controller checks the cookie when the body field is absent.
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'A refresh token is required').optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
  /** When true, every session for the user is revoked, not just this one. */
  allDevices: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Reset token is required'),
  password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
