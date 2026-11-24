import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { defaultPageSize, defaultUseTakeAndSkip } from "../constants";
import type { ApplyPaginationOptions, PageSizeOptions, PaginationDefaults, PaginationInput } from "../types/extensions/pagination.types";
import type { OffsetPaginationFilter, PaginationFilter } from "../types/interfaces/pagination.interface";

export type { PageSizeOptions, PaginationDefaults, PaginationInput };

/**
 * A page past `maxPage`, or an offset past its first row. A `RangeError`, so an application can answer it as a
 * bad request in one place.
 */
export class PageOutOfRangeError extends RangeError {
  /** The page asked for, counted from `firstPage`; for an offset, the page it falls in. */
  readonly page: number;
  /** The last page a read may ask for. */
  readonly maxPage: number;

  constructor(page: number, maxPage: number) {
    super(`Page ${page} is past the last page that can be read, ${maxPage}`);

    this.name = 'PageOutOfRangeError';
    this.page = page;
    this.maxPage = maxPage;
  }
}

let paginationDefaults: PaginationDefaults = {};

/**
 * Sets the options every paginated read takes when its call doesn't give them: `firstPage`, `defaultPageSize`,
 * `maxPageSize` and `maxPage`. Replaces what an earlier call set, so `setPaginationDefaults({})` goes back to
 * pages counted from 1, 10 rows a page and no limits. Call it once, where the extensions are loaded.
 */
export function setPaginationDefaults(defaults: PaginationDefaults): void {
  paginationDefaults = { ...defaults };
}

/** The options `setPaginationDefaults` set. */
export function getPaginationDefaults(): PaginationDefaults {
  return { ...paginationDefaults };
}

const resolveOption = <Key extends keyof PaginationDefaults>(
  options: PaginationDefaults | undefined,
  key: Key
): PaginationDefaults[Key] => options?.[key] ?? paginationDefaults[key];

// an unparsed query parameter is a string: "20" + 1 would be "201"; past MAX_SAFE_INTEGER a number is
// written in exponent form (`OFFSET 1e+22`), which no database reads
const toInteger = (value: unknown, min: number, fallback: number): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number) && number >= min
    ? Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER)
    : fallback;
};

const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

/**
 * The page size to read: a number or a numeric string of at least 1, rounded down; the default page size
 * otherwise. Never above `maxPageSize` when one is given.
 */
export const normalizePageSize = (pageSize: unknown, options?: PageSizeOptions): number =>
  Math.min(
    toInteger(pageSize, 1, toInteger(resolveOption(options, 'defaultPageSize'), 1, defaultPageSize)),
    toInteger(resolveOption(options, 'maxPageSize'), 1, Number.MAX_SAFE_INTEGER)
  );

/** Limits the rows with `take`, which counts entities rather than rows when the query joins a collection, or with `limit`. */
export const setPageLimit = <Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  limit: number,
  useTakeAndSkip: boolean
): SelectQueryBuilder<Entity> => (useTakeAndSkip ? builder.take(limit) : builder.limit(limit));

// which one `input: 'any'` reads: a page when the filter gives page or pageSize, its offset / limit otherwise
const readsOffsetOf = (filter: PaginationFilter & OffsetPaginationFilter, input: PaginationInput | undefined): boolean => {
  if (input === 'page' || input === 'offset') {
    return input === 'offset';
  }

  return isNil(filter.page) && isNil(filter.pageSize) && (!isNil(filter.offset) || !isNil(filter.limit));
};

/**
 * The `limit` and `offset` to read. A filter with `page` or `pageSize` gives a page: the first one and the
 * default page size when it doesn't say (or says something that is not a number). A filter with neither gives
 * `offset` and `limit`: from the first row (a negative offset too) and the default page size. `input` reads one
 * of the two whatever the filter gives. Also returns the page read, counted from `firstPage` (for an offset, the
 * page it falls in), and the page size. Throws a `PageOutOfRangeError` past `maxPage`.
 */
export const getLimitAndOffset = (
  paginationFilter: PaginationFilter | OffsetPaginationFilter | null | undefined,
  options?: PaginationDefaults
) => {
  const filter = (paginationFilter ?? {}) as PaginationFilter & OffsetPaginationFilter;
  const firstPage = resolveOption(options, 'firstPage') === 0 ? 0 : 1;
  const readsOffset = readsOffsetOf(filter, resolveOption(options, 'input'));
  const limit = normalizePageSize(readsOffset ? filter.limit : filter.pageSize, options);
  // a page past the last representable offset is just as empty
  const offset = readsOffset
    ? toInteger(filter.offset, 0, 0)
    : Math.min(toInteger(filter.page, firstPage, firstPage) - firstPage, Math.floor(Number.MAX_SAFE_INTEGER / limit)) * limit;
  const page = Math.floor(offset / limit) + firstPage;
  const maxPage = toInteger(resolveOption(options, 'maxPage'), firstPage, Number.MAX_SAFE_INTEGER);

  if (page > maxPage) {
    throw new PageOutOfRangeError(page, maxPage);
  }

  return { limit, offset, page, pageSize: limit };
};

/** What `applyPagination` does, for code that must not depend on what is patched under that name. */
export const paginateQuery = <Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter | OffsetPaginationFilter,
  options?: ApplyPaginationOptions
): SelectQueryBuilder<Entity> => {
  const { useTakeAndSkip = defaultUseTakeAndSkip, ...pageOptions } = options || {};
  const { limit, offset } = getLimitAndOffset(paginationFilter, pageOptions);

  return useTakeAndSkip ? builder.take(limit).skip(offset) : builder.limit(limit).offset(offset);
};
