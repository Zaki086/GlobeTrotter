import type { RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { ApiError } from '../utils/ApiError';

export interface ValidationSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

/**
 * Validates and *replaces* the request parts with their parsed output, so
 * downstream code receives coerced, stripped, typed values rather than raw
 * strings. Anything not declared in a schema is dropped — that is the
 * mass-assignment defence.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        // req.query has only a getter in Express 5 and is read-only-ish in 4;
        // defineProperty keeps this working across both.
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          ApiError.validation(
            err.issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          ),
        );
      }
      next(err);
    }
  };
}

export default validate;
