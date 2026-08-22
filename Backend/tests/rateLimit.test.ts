/**
 * Rate limiter behaviour.
 *
 * The rest of the suite runs with RATE_LIMIT_ENABLED=false (shared per-IP
 * buckets would make unrelated tests order-dependent), so these tests drive
 * the limiter directly instead of going through the app. That also lets them
 * assert the *sliding window* property, which is the part a fixed-window
 * implementation would get wrong.
 */
import type { Request, Response } from 'express';
import { createRateLimiter } from '../src/middleware/rateLimiter';
import { redis } from '../src/config/redis';
import { env } from '../src/config/env';
import { ApiError } from '../src/utils/ApiError';
import { closeConnections } from './helpers';

// `env` is parsed once at import, so setting process.env here would be too
// late — imports are hoisted above it. Flip the resolved config instead.
(env as { RATE_LIMIT_ENABLED: boolean }).RATE_LIMIT_ENABLED = true;

function fakeReq(ip = '203.0.113.10'): Request {
  return { ip, originalUrl: '/test', headers: {}, socket: { remoteAddress: ip } } as unknown as Request;
}

function fakeRes(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    getHeaders: () => headers,
  } as unknown as Response;
}

/** Runs the middleware once and reports whether it allowed the request. */
async function hit(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
  const res = fakeRes();
  return new Promise<{ allowed: boolean; error?: ApiError; res: Response }>((resolve) => {
    limiter(fakeReq(ip), res, ((err?: unknown) => {
      resolve({ allowed: !err, error: err as ApiError, res });
    }) as never);
  });
}

const uniqueIp = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}-${Date.now()}`;

beforeAll(async () => {
  // The limiter fails open when Redis is down, which would silently pass
  // these tests. Make the dependency explicit.
  const pong = await redis.ping();
  expect(pong).toBe('PONG');
});

afterAll(async () => {
  await closeConnections();
});

describe('sliding window rate limiter', () => {
  it('allows requests up to the limit and blocks the next one', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: 'test:basic' });
    const ip = uniqueIp();

    expect((await hit(limiter, ip)).allowed).toBe(true);
    expect((await hit(limiter, ip)).allowed).toBe(true);
    expect((await hit(limiter, ip)).allowed).toBe(true);

    const blocked = await hit(limiter, ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.error).toBeInstanceOf(ApiError);
    expect(blocked.error?.statusCode).toBe(429);
  });

  it('keys buckets independently per client', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: 'test:perclient' });
    const a = uniqueIp();
    const b = uniqueIp();

    expect((await hit(limiter, a)).allowed).toBe(true);
    expect((await hit(limiter, a)).allowed).toBe(false);
    // A different client is unaffected.
    expect((await hit(limiter, b)).allowed).toBe(true);
  });

  it('keys buckets independently per route prefix', async () => {
    const one = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: 'test:routeone' });
    const two = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: 'test:routetwo' });
    const ip = uniqueIp();

    expect((await hit(one, ip)).allowed).toBe(true);
    expect((await hit(one, ip)).allowed).toBe(false);
    // Exhausting one route must not spend another route's quota.
    expect((await hit(two, ip)).allowed).toBe(true);
  });

  it('sets RateLimit headers', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'test:headers' });
    const ip = uniqueIp();

    const first = await hit(limiter, ip);
    const headers = (first.res.getHeaders as () => Record<string, string>)();
    expect(headers['RateLimit-Limit']).toBe('2');
    expect(headers['RateLimit-Remaining']).toBe('1');
    expect(headers['RateLimit-Policy']).toBe('2;w=60');
  });

  it('sets Retry-After on a blocked request', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: 'test:retry' });
    const ip = uniqueIp();

    await hit(limiter, ip);
    const blocked = await hit(limiter, ip);

    const retryAfter = (blocked.error as ApiError & { retryAfter?: number }).retryAfter;
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  /**
   * The sliding-window property. With a 1s window and a limit of 2:
   * spend the quota, confirm the third is blocked, then wait for the window
   * to slide past the first two and confirm the quota has recovered.
   *
   * A fixed-window counter keyed on a 1s bucket would also pass the recovery
   * half, so the meaningful assertion is the next test.
   */
  it('recovers quota once old entries slide out of the window', async () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2, keyPrefix: 'test:slide' });
    const ip = uniqueIp();

    expect((await hit(limiter, ip)).allowed).toBe(true);
    expect((await hit(limiter, ip)).allowed).toBe(true);
    expect((await hit(limiter, ip)).allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 1100));

    expect((await hit(limiter, ip)).allowed).toBe(true);
  });

  /**
   * The property a fixed window does NOT have.
   *
   * Spend the full quota, wait just over half the window, and try again. Under
   * a fixed window the counter would have reset at the boundary and let the
   * burst through; under a sliding window the earlier requests are still
   * inside the trailing window, so it must stay blocked.
   */
  it('does not let a burst through at a window boundary', async () => {
    const limiter = createRateLimiter({ windowMs: 2000, max: 2, keyPrefix: 'test:noburst' });
    const ip = uniqueIp();

    expect((await hit(limiter, ip)).allowed).toBe(true);
    expect((await hit(limiter, ip)).allowed).toBe(true);

    // Past a fixed 2s boundary, but the first two hits are still < 2s old.
    await new Promise((r) => setTimeout(r, 1200));

    expect((await hit(limiter, ip)).allowed).toBe(false);
  });

  it('blocked requests do not extend their own penalty', async () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyPrefix: 'test:nopenalty' });
    const ip = uniqueIp();

    expect((await hit(limiter, ip)).allowed).toBe(true);

    // Hammer while blocked — these must not be recorded in the window.
    for (let i = 0; i < 5; i++) {
      expect((await hit(limiter, ip)).allowed).toBe(false);
    }

    await new Promise((r) => setTimeout(r, 1100));

    // If rejected attempts had been counted, this would still be blocked.
    expect((await hit(limiter, ip)).allowed).toBe(true);
  });

  it('supports a custom key generator', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: 'test:custom',
      keyGenerator: () => 'everyone',
    });

    expect((await hit(limiter, uniqueIp())).allowed).toBe(true);
    // Different IPs, same bucket.
    expect((await hit(limiter, uniqueIp())).allowed).toBe(false);
  });
});
