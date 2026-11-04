import type { DatabaseType } from 'typeorm';
import type { LikeMatch } from '../types/extensions/search.types';
import { isMysqlLikeDriver, isSqliteLikeDriver } from './sql.utils';

/**
 * Escapes the LIKE wildcards `%` and `_`, and the escape character `\` itself, with a backslash:
 * `50%_off` → `50\%\_off`. The default escape character of PostgreSQL and MySQL;
 * SQLite needs `ESCAPE '\'`, which the search methods add.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** LIKE pattern for `value`: `%value%`, `value%`, `%value` or `value`. */
export function toLikePattern(value: string, match: LikeMatch = 'contains', escape = true): string {
  const text = escape ? escapeLikePattern(value) : value;

  switch (match) {
    case 'contains':
      return `%${text}%`;
    case 'prefix':
      return `${text}%`;
    case 'suffix':
      return `%${text}`;
    case 'exact':
      return text;
    default:
      throw new TypeError(`Invalid match "${match}": expected "contains", "prefix", "suffix" or "exact"`);
  }
}

/**
 * Trimmed search term, or `undefined` when there is nothing to search for (`null`, `undefined`,
 * an empty or blank string): search methods add no condition then.
 */
export function toSearchTerm(value: unknown, methodName: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${methodName} expects a string to search for, got ${typeof value}`);
  }

  const term = value.trim();

  return term.length > 0 ? term : undefined;
}

// `unaccent`, `public.f_unaccent`: a function name, optionally schema-qualified
const FUNCTION_NAME = /^[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?$/;

/** Function to wrap both sides with for `unaccent`, or `undefined` for none. */
export function toUnaccentFunction(unaccent: boolean | string | undefined): string | undefined {
  if (unaccent === undefined || unaccent === false) {
    return undefined;
  }

  if (unaccent === true) {
    return 'unaccent';
  }

  if (typeof unaccent !== 'string' || !FUNCTION_NAME.test(unaccent)) {
    // the name is inserted into the SQL as is
    throw new TypeError(`Invalid unaccent function "${unaccent}": expected a function name like "unaccent"`);
  }

  return unaccent;
}

/**
 * Case-insensitive LIKE of `column` against `parameter` in the syntax of the database:
 * - PostgreSQL (and any other driver): `column ILIKE :p`, which `gin_trgm_ops` indexes support;
 * - MySQL / MariaDB: `column LIKE :p`, case-insensitive with the default `_ci` collations;
 * - SQLite: `column LIKE :p ESCAPE '\'`, case-insensitive for ASCII; SQLite has no default
 *   escape character.
 *
 * With `unaccentFunction`, both sides are wrapped with it: `unaccent(column) ILIKE unaccent(:p)`.
 */
export function buildILikeCondition(
  driver: DatabaseType | undefined,
  column: string,
  parameter: string,
  unaccentFunction?: string
): string {
  const left = unaccentFunction ? `${unaccentFunction}(${column})` : column;
  const right = unaccentFunction ? `${unaccentFunction}(${parameter})` : parameter;

  if (isMysqlLikeDriver(driver)) {
    return `${left} LIKE ${right}`;
  }

  if (isSqliteLikeDriver(driver)) {
    return `${left} LIKE ${right} ESCAPE '\\'`;
  }

  return `${left} ILIKE ${right}`;
}
