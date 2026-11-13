import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { DatabaseType } from 'typeorm';
import { isPostgresLikeDriver, isSqliteLikeDriver } from './sql.utils';
import { isDate } from './common.utils';

/** `->>` gives the value as text (as an SQL value on SQLite), `->` as JSON. */
export type JsonAccessor = 'text' | 'json';

const JSON_COLUMN_TYPES: readonly string[] = ['json', 'jsonb', 'simple-json'];

export const isJsonColumn = (column: ColumnMetadata): boolean => JSON_COLUMN_TYPES.includes(String(column.type));

/** Wraps a JSON key in single quotes, doubling any quote inside it (standard SQL string literal). */
const toJsonKeyLiteral = (fieldName: string): string => `'${String(fieldName).replace(/'/g, "''")}'`;

/** `-> 'settings' ->> 'theme'`: every key but the last one with `->`, the last one with `jsonOperator`. */
export function buildJsonPath(fieldNames: readonly string[], jsonOperator: '->>' | '->'): string {
  return fieldNames
    .map((fieldName, index) => `${index === fieldNames.length - 1 ? jsonOperator : '->'} ${toJsonKeyLiteral(fieldName)}`)
    .join(' ');
}


/**
 * PostgreSQL type to compare a `->>` value (text) with `value` as: text compares `'9' >= '10'` as true.
 * An array (IN, ANY) is typed by its first value; strings and unknown values stay text.
 */
function getJsonTextCast(value: unknown): string | undefined {
  const sample = Array.isArray(value) ? value.find((item) => item !== null && item !== undefined) : value;

  if (typeof sample === 'number' || typeof sample === 'bigint') {
    return 'numeric';
  }

  if (typeof sample === 'boolean') {
    return 'boolean';
  }

  if (isDate(sample)) {
    return 'timestamptz';
  }

  return undefined;
}

export interface JsonPathSqlOptions {
  /** Defaults to `'text'`. */
  accessor?: JsonAccessor;
  /** The value the path is compared with: on PostgreSQL a `'text'` path is cast to its type. */
  value?: unknown;
  /** Compares a `'text'` path as a timestamp whatever `value` is, since a period also takes date strings. */
  asTimestamp?: boolean;
}

/**
 * SQL for a path inside a JSON column: `"exec"."details" -> 'meta' ->> 'endTs'`, cast on PostgreSQL to the
 * type of the compared value (`CAST(… AS numeric)`). A `simple-json` column is text there, so it is cast to
 * `jsonb` first. SQLite (3.38+) has the same operators, and `->>` gives SQL values, so it needs no cast, except
 * for a timestamp: there it is rewritten in the format TypeORM stores dates and binds `Date` parameters in.
 */
export function toJsonPathSql(
  driver: DatabaseType | undefined,
  columnSql: string,
  column: ColumnMetadata,
  jsonPath: readonly string[],
  { accessor = 'text', value, asTimestamp = false }: JsonPathSqlOptions = {}
): string {
  const path = buildJsonPath(jsonPath, accessor === 'json' ? '->' : '->>');
  const isTimestamp = asTimestamp && accessor === 'text';

  if (isSqliteLikeDriver(driver)) {
    const sql = `${columnSql} ${path}`;

    return isTimestamp ? `strftime('%Y-%m-%d %H:%M:%f', ${sql})` : sql;
  }

  if (!isPostgresLikeDriver(driver)) {
    throw new TypeError(
      `Typed keys into a JSON column (${column.propertyPath}.${jsonPath.join('.')}) are supported on PostgreSQL and SQLite, ` +
        `not on ${driver ?? 'a query without a connection'}`
    );
  }

  const source = String(column.type) === 'simple-json' ? `CAST(${columnSql} AS jsonb)` : columnSql;
  const sql = `${source} ${path}`;
  const cast = isTimestamp ? 'timestamptz' : accessor === 'text' ? getJsonTextCast(value) : undefined;

  return cast ? `CAST(${sql} AS ${cast})` : sql;
}
