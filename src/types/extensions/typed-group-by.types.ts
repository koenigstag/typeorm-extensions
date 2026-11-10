export type TypedGroupByOptions = {
  /**
   * Group by the quoted database column (`"ticket"."ticket_status"`) instead of `ticket.status`,
   * which TypeORM maps to the column itself. TypeORM maps only aliases with metadata, so a subquery
   * in FROM needs it on PostgreSQL, where an unquoted `sub.firstName` is folded to `firstname`.
   */
  useQuotes?: boolean;
};
