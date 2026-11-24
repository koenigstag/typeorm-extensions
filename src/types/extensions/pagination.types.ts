export type PageSizeOptions = {
  /** The page size when the filter has none, or none of at least 1; 10 when not given. */
  defaultPageSize?: number;
  /**
   * The largest page size read: a larger `pageSize` (or `defaultPageSize`) is lowered to it, so a client
   * can't ask for the whole table in one page. No limit when not given, or not a number of at least 1.
   */
  maxPageSize?: number;
};

export type PageNumberOptions = {
  /** The number of the first page: 1 (the default) or 0. The `page` a paginated read returns counts the same way. */
  firstPage?: 0 | 1;
  /**
   * The last page a read may ask for, counted from `firstPage`. A later page, or an `offset` past its first row,
   * throws a `PageOutOfRangeError` before the query runs, so a client can't make the database skip a whole
   * table. No limit when not given, or not a whole number of at least `firstPage`.
   */
  maxPage?: number;
};

/** What a paginated read takes from its filter: a page, an offset, or whichever the filter gives. */
export type PaginationInput = 'page' | 'offset' | 'any';

export type PaginationInputOptions = {
  /**
   * `'page'` reads only `page` / `pageSize`, `'offset'` only `offset` / `limit`. `'any'`, the default, reads a page
   * when the filter gives `page` or `pageSize`, and its `offset` / `limit` otherwise. Make `'page'` the default when
   * filters come from requests that may carry fields their lists don't declare: a stray `limit` then changes
   * neither the page nor its size.
   */
  input?: PaginationInput;
};

/** The options `setPaginationDefaults` sets for every paginated read whose call doesn't give its own. */
export type PaginationDefaults = PageSizeOptions & PageNumberOptions & PaginationInputOptions;

export type ApplyPaginationOptions = PaginationDefaults & {
  useTakeAndSkip?: boolean;
};

/** Option of the paginated reads: `getManyWithTotals`, `getRawManyWithTotals` and both cursor methods. */
export type IncludeOrderByOption = {
  /**
   * Add `orderBy` to the result, the ORDER BY the page was read in, for logs and debugging. Off by
   * default: its selectors are SQL (`"user"."created_at"`, a `CASE`), which a response passed on to a
   * client shouldn't carry.
   */
  includeOrderBy?: boolean;
};
