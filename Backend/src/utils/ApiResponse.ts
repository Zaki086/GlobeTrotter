import type { Response } from 'express';
import type { FieldError } from './ApiError';

/**
 * The one and only success envelope:
 *   { success: true, data: {}, message: "" }
 * and failure envelope:
 *   { success: false, message: "...", errors: [] }
 * Nothing in this codebase writes a response body by any other route.
 */

export interface SuccessBody<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export interface FailureBody {
  success: false;
  message: string;
  errors?: FieldError[];
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = '',
  statusCode = 200,
  meta?: PaginationMeta,
): Response<SuccessBody<T>> {
  const body: SuccessBody<T> = { success: true, data, message };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully') {
  return sendSuccess(res, data, message, 201);
}

export function sendFailure(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: FieldError[],
  code?: string,
): Response<FailureBody> {
  const body: FailureBody = { success: false, message };
  if (errors?.length) body.errors = errors;
  if (code) body.code = code;
  return res.status(statusCode).json(body);
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
