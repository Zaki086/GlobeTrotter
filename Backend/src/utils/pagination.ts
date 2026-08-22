import { PAGINATION } from '../config/constants';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/** Normalizes user-supplied paging into safe Prisma skip/take values. */
export function resolvePagination(input: PaginationInput = {}): PaginationOptions {
  const page = Math.max(1, Math.trunc(input.page ?? PAGINATION.DEFAULT_PAGE));
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Math.trunc(input.limit ?? PAGINATION.DEFAULT_LIMIT)),
  );
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
