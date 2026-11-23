export type PageSizeOptions = {
  /** The page size when the filter has none, or none of at least 1; 10 when not given. */
  defaultPageSize?: number;
  /**
   * The largest page size read: a larger `pageSize` (or `defaultPageSize`) is lowered to it, so a client
   * can't ask for the whole table in one page. No limit when not given, or not a number of at least 1.
   */
  maxPageSize?: number;
};

export type ApplyPaginationOptions = PageSizeOptions & {
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
