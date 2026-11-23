import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { defaultPageSize, defaultUseTakeAndSkip } from "../constants";
import type { ApplyPaginationOptions } from "../types/extensions/pagination.types";
import { PaginationFilter } from "../types/interfaces/pagination.interface";

// an unparsed query parameter is a string: "20" + 1 would be "201"; past MAX_SAFE_INTEGER a number is
// written in exponent form (`OFFSET 1e+22`), which no database reads
const toPositiveInteger = (value: unknown, fallback: number): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number) && number >= 1
    ? Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER)
    : fallback;
};

export type PageSizeOptions = {
  /** The page size when the filter has none, or none of at least 1; 10 when not given. */
  defaultPageSize?: number;
};

const resolveDefaultPageSize = (options?: PageSizeOptions): number => toPositiveInteger(options?.defaultPageSize, defaultPageSize);

/** The page size to read: a number or a numeric string of at least 1, rounded down; the default page size otherwise. */
export const normalizePageSize = (pageSize: unknown, options?: PageSizeOptions): number =>
  toPositiveInteger(pageSize, resolveDefaultPageSize(options));

/** Limits the rows with `take`, which counts entities rather than rows when the query joins a collection, or with `limit`. */
export const setPageLimit = <Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  limit: number,
  useTakeAndSkip: boolean
): SelectQueryBuilder<Entity> => (useTakeAndSkip ? builder.take(limit) : builder.limit(limit));

/**
 * The `limit` and `offset` of a 1-based page: page 1 and the default page size when the filter doesn't give
 * them (or gives text that is not a number of at least 1). Also returns the page and page size it used.
 */
export const getLimitAndOffset = (paginationFilter: PaginationFilter | null | undefined, options?: PageSizeOptions) => {
  const { page, pageSize } = paginationFilter ?? {};
  const normalizedPageSize = normalizePageSize(pageSize, options);
  // a page past the last representable offset is just as empty
  const normalizedPage = Math.min(toPositiveInteger(page, 1), Math.floor(Number.MAX_SAFE_INTEGER / normalizedPageSize) + 1);

  return {
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
};

/** What `applyPagination` does, for code that must not depend on what is patched under that name. */
export const paginateQuery = <Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter,
  options?: ApplyPaginationOptions
): SelectQueryBuilder<Entity> => {
  const { useTakeAndSkip = defaultUseTakeAndSkip } = options || {};
  const { limit, offset } = getLimitAndOffset(paginationFilter);

  return useTakeAndSkip ? builder.take(limit).skip(offset) : builder.limit(limit).offset(offset);
};
