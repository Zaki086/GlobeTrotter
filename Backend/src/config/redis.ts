import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    // Back off quickly at first, then settle at 2s between attempts.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on('connect', () => logger.info('Redis connecting'));
  client.on('ready', () => logger.info('Redis ready'));
  client.on('error', (err) => logger.error('Redis error', { message: err.message }));
  client.on('close', () => logger.warn('Redis connection closed'));

  return client;
}

export const redis = globalForRedis.redis ?? createClient();
if (!env.isProduction) globalForRedis.redis = redis;

/**
 * Redis is a hard dependency for rate limiting but a soft one for caching.
 * `isRedisHealthy` lets callers degrade gracefully rather than 500 the request.
 */
export function isRedisHealthy(): boolean {
  return redis.status === 'ready';
}

export async function pingRedis(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch {
    redis.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Cache helpers — every failure is swallowed so a Redis outage degrades to
// "slower", never to "broken".
// ---------------------------------------------------------------------------

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisHealthy()) return null;
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.warn('Cache read failed', { key, message: (err as Error).message });
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!isRedisHealthy()) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn('Cache write failed', { key, message: (err as Error).message });
    }
  },

  async del(...keys: string[]): Promise<void> {
    if (!isRedisHealthy() || keys.length === 0) return;
    try {
      await redis.del(...keys);
    } catch (err) {
      logger.warn('Cache delete failed', { keys, message: (err as Error).message });
    }
  },

  /** Deletes by pattern using SCAN so we never block Redis with KEYS. */
  async delPattern(pattern: string): Promise<void> {
    if (!isRedisHealthy()) return;
    try {
      let cursor = '0';
      do {
        const [next, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (found.length) await redis.del(...found);
      } while (cursor !== '0');
    } catch (err) {
      logger.warn('Cache pattern delete failed', { pattern, message: (err as Error).message });
    }
  },
};

export default redis;
