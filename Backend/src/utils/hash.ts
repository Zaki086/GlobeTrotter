import crypto from 'node:crypto';

/**
 * Stable short digest of an arbitrary object — used to build cache keys from
 * query parameters. Keys are sorted so `{a,b}` and `{b,a}` hit the same entry.
 */
export function stableHash(value: unknown): string {
  return crypto.createHash('sha1').update(stableStringify(value)).digest('hex').slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

export function randomToken(bytes = 32): { token: string; hash: string } {
  const token = crypto.randomBytes(bytes).toString('hex');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
