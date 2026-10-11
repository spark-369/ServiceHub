/**
 * Shared pagination parsing helpers.
 *
 * `parseInt(searchParams.get("page") || "1")` looks safe but returns `NaN`
 * when a caller supplies a non-numeric value (e.g. `?page=abc`), which then
 * propagates into Prisma's `skip`/`take` and throws a 500. These helpers
 * coerce anything invalid back to sane defaults and clamp `limit` so a client
 * cannot request an unbounded page size.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/** Parse `page`/`limit` query params into a safe, clamped pagination object. */
export function parsePagination(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): Pagination {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;

  const page = toPositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const requestedLimit = toPositiveInt(
    searchParams.get("limit"),
    defaultLimit
  );
  const limit = Math.min(requestedLimit, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

/** Shape returned to clients describing the current page. */
export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export default parsePagination;
