import { databaseDriver, mysqlLikeDrivers } from '../constants/database';

type QueryWithSql = {
  getQuery(): string;
  getQueryAndParameters(): [string, unknown[]];
  connection: { options: { type: string } };
};

/** Whether the suite runs on MySQL / MariaDB, where identifiers take backticks. */
export const mysqlRun = mysqlLikeDrivers.includes(databaseDriver);

const usesBackticks = (query: QueryWithSql): boolean =>
  mysqlLikeDrivers.includes(query.connection.options.type as never);

/**
 * The SQL of a query builder with identifiers in double quotes, as PostgreSQL and SQLite write them,
 * so one expectation fits every driver: MySQL quotes them with backticks.
 */
export const sqlOf = (query: QueryWithSql): string => {
  const sql = query.getQuery();

  return usesBackticks(query) ? sql.replace(/`/g, '"') : sql;
};

/** `getQueryAndParameters()` with the SQL as {@link sqlOf} gives it. */
export const sqlAndParametersOf = (query: QueryWithSql): [string, unknown[]] => {
  const [sql, parameters] = query.getQueryAndParameters();

  return [usesBackticks(query) ? sql.replace(/`/g, '"') : sql, parameters];
};

/** SQL that a test writes itself, with double-quoted identifiers: in backticks on MySQL. */
export const nativeSql = (sql: string): string =>
  mysqlRun ? sql.replace(/"/g, '`') : sql;
