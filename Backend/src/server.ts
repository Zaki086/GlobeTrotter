import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { disconnectRedis, pingRedis } from './config/redis';

let server: Server | undefined;

async function bootstrap() {
  await connectDatabase();

  // Redis backs rate limiting and caching. Both degrade gracefully, so a cold
  // Redis is logged loudly but does not stop the server from serving traffic.
  if (await pingRedis()) {
    logger.info('Redis connection verified');
  } else {
    logger.warn('Redis is unreachable — rate limiting and caching are degraded');
  }

  const app = createApp();

  server = app.listen(env.PORT, () => {
    logger.info('GlobeTrotter API started', {
      port: env.PORT,
      environment: env.NODE_ENV,
      apiPrefix: env.API_PREFIX,
      docs: `http://localhost:${env.PORT}/api/docs`,
    });
  });

  server.on('error', (err) => {
    logger.error('HTTP server error', { message: err.message });
    process.exit(1);
  });
}

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests
 * finish, then close the database and Redis. A hard 15s deadline prevents a
 * stuck connection from hanging a container restart forever.
 */
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { message: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// An uncaught exception leaves the process in an unknown state — log it and
// let the supervisor restart us rather than limping along.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  void shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.error('Failed to start server', { message: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
