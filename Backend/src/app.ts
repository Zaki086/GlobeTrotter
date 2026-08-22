import express, { type Express } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { openApiDocument } from './docs/openapi';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { sanitizeRequest } from './middleware/sanitize';
import { rateLimiters } from './middleware/rateLimiter';
import {
  additionalSecurityHeaders,
  corsMiddleware,
  helmetMiddleware,
  preventParameterPollution,
  requestSizeLimit,
} from './middleware/security';

/**
 * Builds the Express application.
 *
 * Exported separately from server.ts so Supertest can mount the app without
 * binding a port or opening a second connection pool.
 */
export function createApp(): Express {
  const app = express();

  // Behind a load balancer, req.ip must come from X-Forwarded-For or every
  // IP-keyed rate limit would collapse onto the proxy's address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Security ------------------------------------------------------------
  app.use(helmetMiddleware);
  app.use(additionalSecurityHeaders);
  app.use(corsMiddleware);

  // --- Body parsing --------------------------------------------------------
  app.use(requestSizeLimit(parseBodyLimit(env.JSON_BODY_LIMIT)));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));
  app.use(cookieParser());

  // --- Hygiene -------------------------------------------------------------
  app.use(compression());
  app.use(preventParameterPollution);
  app.use(sanitizeRequest);
  app.use(requestLogger);

  // --- Docs ----------------------------------------------------------------
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'GlobeTrotter API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
  app.get('/api/docs.json', (_req, res) => res.json(openApiDocument));

  // --- API -----------------------------------------------------------------
  // Global limiter is a backstop; per-route limiters do the real work.
  app.use(env.API_PREFIX, rateLimiters.global, routes);

  // Root banner so hitting the bare host is not a 404.
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'GlobeTrotter API',
        version: '1.0.0',
        docs: '/api/docs',
        health: `${env.API_PREFIX}/health`,
      },
      message: 'GlobeTrotter API is running',
    });
  });

  // --- Errors --------------------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** Converts "1mb" / "512kb" / "2048" into bytes for the pre-parse size check. */
function parseBodyLimit(limit: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(limit.trim());
  if (!match) return 1024 * 1024;
  const value = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  const multiplier = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[unit] ?? 1;
  return Math.floor(value * multiplier);
}

export default createApp;
