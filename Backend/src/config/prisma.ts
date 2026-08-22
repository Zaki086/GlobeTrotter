import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

/**
 * Single shared client. Cached on globalThis so `tsx watch` hot reloads and
 * Jest module resets do not open a new connection pool each time.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

if (env.isDevelopment) {
  // `as never` — Prisma's event map is only narrowed when the log config is a
  // literal, which it is not here because of the ternary above.
  prisma.$on('query' as never, (e: Prisma.QueryEvent) => {
    if (e.duration >= 200) {
      logger.debug('Slow query', { durationMs: e.duration, query: e.query });
    }
  });
}

prisma.$on('warn' as never, (e: Prisma.LogEvent) => logger.warn('Prisma warning', { message: e.message }));
prisma.$on('error' as never, (e: Prisma.LogEvent) => logger.error('Prisma error', { message: e.message }));

if (!env.isProduction) globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}

export default prisma;
