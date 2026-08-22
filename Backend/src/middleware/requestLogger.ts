import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { httpLogger, logger } from '../config/logger';

/**
 * Assigns a request id, echoes it back as `X-Request-Id`, and logs one line
 * per completed request. Bodies are never logged — only metadata — so
 * credentials cannot leak through the access log.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const requestId = (typeof incoming === 'string' && incoming.slice(0, 64)) || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userId: req.auth?.userId,
      userAgent: req.headers['user-agent'],
    };

    httpLogger.log('http', 'request', entry);

    // Surface server errors and slow requests on the main channel too.
    if (res.statusCode >= 500) logger.error('Request failed', entry);
    else if (durationMs > 1500) logger.warn('Slow request', entry);
  });

  next();
};

export default requestLogger;
