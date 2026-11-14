import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { defaultPageSize, defaultUseTakeAndSkip } from "../constants";
import type { ApplyPaginationOptions } from "../types/extensions/pagination.types";
import { PaginationFilter } from "../types/interfaces/pagination.interface";

// an unparsed query parameter is a string: "20" + 1 would be "201"
const toPositiveInteger = (value: unknown, fallback: number): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
};

/** The page size to read: a number or a numeric string of at least 1, rounded down; `defaultPageSize` otherwise. */
export const normalizePageSize = (pageSize: unknown): number => toPositiveInteger(pageSize, defaultPageSize);

/** Limits the rows with `take`, which counts entities rather than rows when the query joins a collection, or with `limit`. */
export const setPageLimit = <Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  limit: number,
  useTakeAndSkip: boolean
): SelectQueryBuilder<Entity> => (useTakeAndSkip ? builder.take(limit) : builder.limit(limit));

export const getLimitAndOffset =({ page, pageSize }: PaginationFilter) => {
  const normalizedPage = toPositiveInteger(page, 1);
  const normalizedPageSize = normalizePageSize(pageSize);

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
