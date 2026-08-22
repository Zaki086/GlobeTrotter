import argon2 from 'argon2';

/**
 * Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1).
 * Raw passwords exist only as function arguments — never stored, never logged.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed hash — treat as a failed login rather than a crash.
    return false;
  }
}

/** True when the stored hash used weaker params and should be upgraded on login. */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
