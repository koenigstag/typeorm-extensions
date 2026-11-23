export type TypedGroupByOptions = {
  /**
   * Group by the quoted database column (`"ticket"."ticket_status"`) instead of `ticket.status`,
   * which TypeORM maps to the column itself. Keys of an alias without metadata (a subquery in FROM)
   * are quoted unless this is `false`: PostgreSQL folds an unquoted `sub.firstName` to `firstname`.
   */
  useQuotes?: boolean;
};
