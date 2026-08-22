import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

/**
 * Any http(s)://localhost:PORT or http(s)://127.0.0.1:PORT origin.
 *
 * Dev servers pick whatever port is free — Vite moves to 5174, 5199, … when
 * 5173 is taken — so pinning the whitelist to one port means the browser
 * blocks the preflight and the client reports a bare "Network Error" with
 * nothing useful in it. Matching any loopback port in development removes a
 * whole class of confusing local-setup failures.
 */
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Private-network origins (RFC 1918) plus link-local.
 *
 * When the app is served from a laptop and opened on a phone, the browser's
 * Origin is the machine's LAN address, not localhost — so loopback alone is
 * not enough for real device testing. Still development-only.
 */
const PRIVATE_NETWORK_ORIGIN =
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(:\d+)?$/;

/**
 * CORS whitelist. Requests with no Origin (curl, mobile apps, server-to-server)
 * are allowed because CORS is a browser-enforced policy and blocking them buys
 * nothing; browser origins must appear in CORS_ORIGINS.
 */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (env.corsOrigins.includes(origin)) return callback(null, true);

    // Development-only conveniences. Both are gated on NODE_ENV so a
    // misconfigured production deploy cannot silently open up to the world.
    if (env.isDevelopment) {
      if (env.corsOrigins.includes('*')) return callback(null, true);
      if (LOOPBACK_ORIGIN.test(origin)) return callback(null, true);
      if (PRIVATE_NETWORK_ORIGIN.test(origin)) return callback(null, true);
    }

    logger.warn('Blocked CORS origin', { origin });
    return callback(new ApiError(403, `Origin ${origin} is not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400,
};

export const corsMiddleware = cors(corsOptions);

/**
 * Helmet with a CSP tuned for a JSON API that also serves Swagger UI from the
 * same origin (hence the inline style/script allowances scoped to 'self').
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
});

/** Headers helmet does not set for us. */
export const additionalSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Rejects oversized bodies before Express buffers them. body-parser also
 * enforces a limit, but checking Content-Length first avoids reading the
 * stream at all for obviously-too-large uploads.
 */
export function requestSizeLimit(maxBytes: number): RequestHandler {
  return (req, _res, next) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > maxBytes) {
      return next(ApiError.payloadTooLarge(`Request body must not exceed ${maxBytes} bytes`));
    }
    next();
  };
}

/**
 * Express parses `?a=1&a=2` into an array and `?a[b]=1` into an object, which
 * breaks handlers that assume a string (HTTP parameter pollution). Zod would
 * reject those, but collapsing duplicates first gives callers the intuitive
 * "last value wins" behaviour instead of a confusing validation error.
 */
export const preventParameterPollution: RequestHandler = (req, _res, next) => {
  if (!req.query || typeof req.query !== 'object') return next();

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.query)) {
    cleaned[key] = Array.isArray(value) ? value[value.length - 1] : value;
  }
  Object.defineProperty(req, 'query', { value: cleaned, writable: true, configurable: true });
  next();
};
