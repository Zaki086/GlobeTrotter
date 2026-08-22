/**
 * Errors thrown anywhere in the stack. The error middleware turns these into
 * the standard failure envelope; anything that is *not* an ApiError is treated
 * as an unexpected 500 and its message is hidden from the client.
 */
export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: FieldError[];
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    statusCode: number,
    message: string,
    options: { errors?: FieldError[]; code?: string; isOperational?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = options.errors ?? [];
    this.code = options.code;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors: FieldError[] = []) {
    return new ApiError(400, message, { errors, code: 'BAD_REQUEST' });
  }

  static validation(errors: FieldError[], message = 'Validation failed') {
    return new ApiError(422, message, { errors, code: 'VALIDATION_ERROR' });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message, { code: 'CONFLICT' });
  }

  static payloadTooLarge(message = 'Request payload is too large') {
    return new ApiError(413, message, { code: 'PAYLOAD_TOO_LARGE' });
  }

  static tooManyRequests(message = 'Too many requests, please slow down', retryAfter?: number) {
    const err = new ApiError(429, message, { code: 'RATE_LIMITED' });
    if (retryAfter !== undefined) (err as ApiError & { retryAfter?: number }).retryAfter = retryAfter;
    return err;
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR', isOperational: false });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ApiError(503, message, { code: 'SERVICE_UNAVAILABLE' });
  }
}

export default ApiError;
