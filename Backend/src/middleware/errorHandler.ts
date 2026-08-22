import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError, type FieldError } from '../utils/ApiError';
import { sendFailure } from '../utils/ApiResponse';
import { env } from '../config/env';
import { logger } from '../config/logger';

/** 404 for anything that fell through the router. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

interface NormalizedError {
  statusCode: number;
  message: string;
  errors: FieldError[];
  code?: string;
  isOperational: boolean;
}

function normalize(err: unknown): NormalizedError {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
      code: err.code,
      isOperational: err.isOperational,
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      message: 'Validation failed',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
      code: 'VALIDATION_ERROR',
      isOperational: true,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return normalizePrisma(err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      message: 'Invalid data supplied',
      errors: [],
      code: 'BAD_REQUEST',
      isOperational: true,
    };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: 503,
      message: 'Database is unavailable, please try again shortly',
      errors: [],
      code: 'SERVICE_UNAVAILABLE',
      isOperational: true,
    };
  }

  // body-parser signals oversized payloads and malformed JSON this way.
  const anyErr = err as { type?: string; status?: number; message?: string };
  if (anyErr?.type === 'entity.too.large') {
    return {
      statusCode: 413,
      message: 'Request payload is too large',
      errors: [],
      code: 'PAYLOAD_TOO_LARGE',
      isOperational: true,
    };
  }
  if (anyErr?.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      message: 'Request body is not valid JSON',
      errors: [],
      code: 'BAD_REQUEST',
      isOperational: true,
    };
  }

  return {
    statusCode: 500,
    message: 'Something went wrong',
    errors: [],
    code: 'INTERNAL_ERROR',
    isOperational: false,
  };
}

function normalizePrisma(err: Prisma.PrismaClientKnownRequestError): NormalizedError {
  const target = (err.meta?.target as string[] | string | undefined) ?? [];
  const fields = Array.isArray(target) ? target : [target];

  switch (err.code) {
    case 'P2002':
      return {
        statusCode: 409,
        message: 'A record with these details already exists',
        errors: fields.map((field) => ({ field, message: `${field} must be unique` })),
        code: 'CONFLICT',
        isOperational: true,
      };
    case 'P2025':
      return {
        statusCode: 404,
        message: 'Resource not found',
        errors: [],
        code: 'NOT_FOUND',
        isOperational: true,
      };
    case 'P2003':
      return {
        statusCode: 400,
        message: 'Referenced record does not exist',
        errors: fields.map((field) => ({ field, message: `${field} references a missing record` })),
        code: 'BAD_REQUEST',
        isOperational: true,
      };
    case 'P2014':
      return {
        statusCode: 409,
        message: 'This change would break a required relation',
        errors: [],
        code: 'CONFLICT',
        isOperational: true,
      };
    default:
      return {
        statusCode: 500,
        message: 'Database request failed',
        errors: [],
        code: 'DATABASE_ERROR',
        isOperational: false,
      };
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const normalized = normalize(err);

  const context = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: normalized.statusCode,
    userId: req.auth?.userId,
    ip: req.ip,
  };

  if (normalized.isOperational) {
    logger.warn(normalized.message, context);
  } else {
    logger.error('Unhandled error', {
      ...context,
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });
  }

  const retryAfter = (err as { retryAfter?: number })?.retryAfter;
  if (retryAfter !== undefined) res.setHeader('Retry-After', String(retryAfter));

  // Internal messages are only revealed outside production.
  const message =
    normalized.isOperational || !env.isProduction
      ? normalized.message
      : 'Something went wrong';

  sendFailure(res, message, normalized.statusCode, normalized.errors, normalized.code);
};

export default errorHandler;
