import type { Request, RequestHandler, Response } from 'express';
import { redis, isRedisHealthy } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

/**
 * Sliding-window rate limiting backed by a Redis sorted set.
 *
 * Each request adds a member scored with its timestamp; entries older than the
 * window are trimmed before counting. Unlike a fixed window this cannot be
 * gamed by bunching requests either side of a boundary — a client that spends
 * its whole quota at t=0 waits the full window, not until the next tick.
 *
 * The whole read-trim-count-write sequence runs as one Lua script so it is
 * atomic under concurrency, and the reservation is rolled back when the limit
 * is exceeded so a blocked request does not extend its own penalty.
 */
const SLIDING_WINDOW_SCRIPT = `
local key           = KEYS[1]
local now           = tonumber(ARGV[1])
local window_ms     = tonumber(ARGV[2])
local max_requests  = tonumber(ARGV[3])
local member        = ARGV[4]

-- Drop everything that has slid out of the window.
redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)

local count = redis.call('ZCARD', key)

if count >= max_requests then
  -- Oldest surviving entry determines when a slot frees up.
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after_ms = window_ms
  if oldest[2] then
    retry_after_ms = (tonumber(oldest[2]) + window_ms) - now
  end
  return { 0, count, max_requests, retry_after_ms }
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window_ms)

return { 1, count + 1, max_requests, 0 }
`;

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests permitted inside the window. */
  max: number;
  /** Namespace so different routes never share a bucket. */
  keyPrefix: string;
  /** Defaults to the client IP; override to key by user, email, etc. */
  keyGenerator?: (req: Request) => string;
  message?: string;
  /** Skip counting when true (e.g. don't penalise successful logins). */
  skip?: (req: Request) => boolean;
}

/** Trust-proxy-aware client address with a stable fallback. */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const {
    windowMs,
    max,
    keyPrefix,
    keyGenerator = clientIp,
    message = 'Too many requests, please slow down',
    skip,
  } = options;

  return async function rateLimiter(req: Request, res: Response, next) {
    if (!env.RATE_LIMIT_ENABLED || (skip && skip(req))) return next();

    // Fail open: an unreachable Redis must not take the whole API down.
    if (!isRedisHealthy()) {
      logger.warn('Rate limiter bypassed — Redis unavailable', { keyPrefix });
      return next();
    }

    const key = `ratelimit:${keyPrefix}:${keyGenerator(req)}`;
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const [allowed, count, limit, retryAfterMs] = (await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(now),
        String(windowMs),
        String(max),
        member,
      )) as [number, number, number, number];

      const remaining = Math.max(0, limit - count);
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Policy', `${limit};w=${Math.ceil(windowMs / 1000)}`);

      if (!allowed) {
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
        res.setHeader('RateLimit-Reset', String(retryAfterSec));
        logger.warn('Rate limit exceeded', {
          keyPrefix,
          ip: clientIp(req),
          path: req.originalUrl,
          userId: req.auth?.userId,
        });
        return next(ApiError.tooManyRequests(message, retryAfterSec));
      }

      return next();
    } catch (err) {
      logger.error('Rate limiter failed', { keyPrefix, message: (err as Error).message });
      return next();
    }
  };
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** Authenticated users get their own bucket; anonymous traffic falls back to IP. */
const byUserOrIp = (req: Request) => req.auth?.userId ?? clientIp(req);

/**
 * The route-specific limits mandated by the spec. Each one is its own bucket,
 * so hammering search never eats into a user's trip-creation quota.
 */
export const rateLimiters = {
  /** Login → 5/min/IP, keyed on IP + submitted email so one attacker cannot
   *  lock out an entire NAT'd office by guessing one address. */
  login: createRateLimiter({
    windowMs: MINUTE,
    max: 5,
    keyPrefix: 'auth:login',
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
      return `${clientIp(req)}:${email}`;
    },
    message: 'Too many login attempts. Please try again in a minute.',
  }),

  /** Signup → 3/hour/IP */
  signup: createRateLimiter({
    windowMs: HOUR,
    max: 3,
    keyPrefix: 'auth:signup',
    message: 'Too many accounts created from this address. Please try again later.',
  }),

  /** Forgot password → 3/hour */
  forgotPassword: createRateLimiter({
    windowMs: HOUR,
    max: 3,
    keyPrefix: 'auth:forgot-password',
    message: 'Too many password reset requests. Please try again later.',
  }),

  /** Refresh is generous — a mobile client rotating tokens is normal traffic. */
  refresh: createRateLimiter({
    windowMs: MINUTE,
    max: 30,
    keyPrefix: 'auth:refresh',
    message: 'Too many token refresh attempts.',
  }),

  /** Search (cities, activities) → 60/min */
  search: createRateLimiter({
    windowMs: MINUTE,
    max: 60,
    keyPrefix: 'search',
    keyGenerator: byUserOrIp,
    message: 'Search rate limit reached. Please slow down.',
  }),

  /** Create trip → 20/hour */
  createTrip: createRateLimiter({
    windowMs: HOUR,
    max: 20,
    keyPrefix: 'trip:create',
    keyGenerator: byUserOrIp,
    message: 'Trip creation limit reached. Please try again later.',
  }),

  /** Activity add → 120/min (drag-and-drop building is bursty by nature) */
  addActivity: createRateLimiter({
    windowMs: MINUTE,
    max: 120,
    keyPrefix: 'activity:add',
    keyGenerator: byUserOrIp,
    message: 'You are adding activities too quickly.',
  }),

  /** Share link → 30/hour */
  share: createRateLimiter({
    windowMs: HOUR,
    max: 30,
    keyPrefix: 'trip:share',
    keyGenerator: byUserOrIp,
    message: 'Share link limit reached. Please try again later.',
  }),

  /** Copying someone else's public itinerary is expensive — keep it tight. */
  copyTrip: createRateLimiter({
    windowMs: HOUR,
    max: 10,
    keyPrefix: 'trip:copy',
    keyGenerator: byUserOrIp,
    message: 'Copy limit reached. Please try again later.',
  }),

  /** Anonymous public itinerary reads. */
  publicRead: createRateLimiter({
    windowMs: MINUTE,
    max: 100,
    keyPrefix: 'public:read',
    message: 'Too many requests. Please slow down.',
  }),

  /** Catch-all applied to the whole API as a backstop against abuse. */
  global: createRateLimiter({
    windowMs: MINUTE,
    max: 300,
    keyPrefix: 'global',
    keyGenerator: byUserOrIp,
    message: 'Too many requests, please slow down',
  }),

  /** Writes that are not covered by a more specific limiter. */
  write: createRateLimiter({
    windowMs: MINUTE,
    max: 120,
    keyPrefix: 'write',
    keyGenerator: byUserOrIp,
  }),
};

export default rateLimiters;
