export type ApplyPaginationOptions = {
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
