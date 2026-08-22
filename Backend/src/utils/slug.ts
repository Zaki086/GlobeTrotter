import crypto from 'node:crypto';
import { SHARE_SLUG_ALPHABET, SHARE_SLUG_LENGTH } from '../config/constants';

/**
 * Public share slugs are the only thing standing between an unlisted itinerary
 * and the open internet, so they are generated from a CSPRNG (not Math.random)
 * with enough entropy to be unguessable: 31^12 ≈ 7.8e17.
 */
export function generateShareSlug(length = SHARE_SLUG_LENGTH): string {
  const alphabet = SHARE_SLUG_ALPHABET;
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  // Rejection sampling keeps the distribution uniform across the alphabet.
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  for (let i = 0; out.length < length; i++) {
    if (i >= bytes.length) return out + generateShareSlug(length - out.length);
    const byte = bytes[i];
    if (byte < limit) out += alphabet[byte % alphabet.length];
  }
  return out;
}

/** Human-readable slug fragment, used to prefix share links with the trip name. */
export function slugify(input: string, maxLength = 40): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** e.g. "kyoto-in-spring-4f7bqm2xk9dh" */
export function buildShareSlug(tripName: string): string {
  const prefix = slugify(tripName, 32);
  const random = generateShareSlug();
  return prefix ? `${prefix}-${random}` : random;
}
