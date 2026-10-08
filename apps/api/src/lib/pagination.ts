/**
 * Shared pagination helper — reconstructed from service usage evidence:
 *   const { page, limit, skip } = parsePagination(query, { limit: 50 });
 */

export interface PaginationOptions {
  limit?: number;
  maxLimit?: number;
}

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
}

/**
 * Cap on the page number: prevents `?page=100000000` from translating into a
 * multi-billion-row OFFSET that scans the whole table just to return nothing.
 */
const MAX_PAGE = 1_000_000;

export function parsePagination(query: PaginationQuery | undefined | null, options: PaginationOptions = {}) {
  const defaultLimit = options.limit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const page = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(String(query?.page ?? ''), 10) || 1),
  );
  const limit = Math.min(Math.max(1, parseInt(String(query?.limit ?? ''), 10) || defaultLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
