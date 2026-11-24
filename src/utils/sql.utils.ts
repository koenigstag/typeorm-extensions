import type { DatabaseType, ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { randomString } from './common.utils';

export const wrapWithDoubleQoutes = (str: string) =>
  str.includes('"') ? str : `"${str}"`;

export const wrapWithBackQoutes = (str: string) =>
  str.includes('`') ? str : '`' + str + '`';

const BACKTICK = '`';
// one identifier: unquoted (user, firstName) or already quoted ("user", `user`, "a""b")
const UNQUOTED_IDENTIFIER = '[\\p{L}_][\\p{L}\\p{N}_$]*';
const DOUBLE_QUOTED_IDENTIFIER = '"(?:[^"]|"")+"';
const BACK_QUOTED_IDENTIFIER = `${BACKTICK}(?:[^${BACKTICK}]|${BACKTICK}${BACKTICK})+${BACKTICK}`;
const IDENTIFIER = `(?:${UNQUOTED_IDENTIFIER}|${DOUBLE_QUOTED_IDENTIFIER}|${BACK_QUOTED_IDENTIFIER})`;

// `id`, `user.id`, `"user"."id"`, `schema.table.column`, optionally ending with `.*`
const IDENTIFIER_PATH = new RegExp(`^${IDENTIFIER}(?:\\.${IDENTIFIER})*(?:\\.\\*)?$`, 'u');
const IDENTIFIER_PATH_SEGMENT = new RegExp(`${IDENTIFIER}|\\*`, 'gu');
const SINGLE_DOUBLE_QUOTED_IDENTIFIER = new RegExp(`^${DOUBLE_QUOTED_IDENTIFIER}$`, 'u');
const SINGLE_BACK_QUOTED_IDENTIFIER = new RegExp(`^${BACK_QUOTED_IDENTIFIER}$`, 'u');
const UNQUOTED_IDENTIFIER_PATH = new RegExp(`^${UNQUOTED_IDENTIFIER}(?:\\.${UNQUOTED_IDENTIFIER})*$`, 'u');
const SINGLE_UNQUOTED_IDENTIFIER = new RegExp(`^${UNQUOTED_IDENTIFIER}$`, 'u');

/** `firstName`: one unquoted identifier, nothing else. */
export const isUnquotedIdentifier = (value: string): boolean => SINGLE_UNQUOTED_IDENTIFIER.test(value);

/** `user.firstName`, `firstName`: unquoted identifiers joined by dots, nothing else. */
export const isUnquotedIdentifierPath = (value: string): boolean => UNQUOTED_IDENTIFIER_PATH.test(value);

/** `"user"."firstName"`, `user.id`: identifiers, quoted or not, joined by dots; not an expression. */
export const isIdentifierPath = (value: string): boolean => IDENTIFIER_PATH.test(value);

/** MySQL, MariaDB and Aurora MySQL: backtick identifiers, `<=>` null-safe comparison. */
export const isMysqlLikeDriver = (driver?: DatabaseType): boolean =>
  driver === 'mysql' || driver === 'mariadb' || driver === 'aurora-mysql';

// `string[]`: TypeORM 1.0 removed the `sqlite` driver from `DatabaseType`, 0.3.x still has it
const SQLITE_LIKE_DRIVERS: readonly string[] = [
  'sqlite',
  'better-sqlite3',
  'sqljs',
  'capacitor',
  'cordova',
  'expo',
  'nativescript',
  'react-native',
];

const POSTGRES_LIKE_DRIVERS: readonly string[] = ['postgres', 'aurora-postgres', 'cockroachdb'];

/** PostgreSQL and the databases speaking its dialect. */
export const isPostgresLikeDriver = (driver?: DatabaseType): boolean =>
  driver !== undefined && POSTGRES_LIKE_DRIVERS.includes(driver);

/** SQLite drivers: `IS` / `IS NOT` are null-safe comparisons. */
export const isSqliteLikeDriver = (driver?: DatabaseType): boolean =>
  driver !== undefined && SQLITE_LIKE_DRIVERS.includes(driver);

/** `field IS [NOT] DISTINCT FROM value` in the database's own null-safe syntax. */
export function buildDistinctCondition(
  driver: DatabaseType | undefined,
  field: string,
  distinct: boolean,
  value: string
): string {
  if (isMysqlLikeDriver(driver)) {
    // `<=>` is MySQL's null-safe equality
    return distinct ? `NOT (${field} <=> ${value})` : `${field} <=> ${value}`;
  }

  if (isSqliteLikeDriver(driver)) {
    // SQLite's `IS` / `IS NOT` compare any values null-safely (IS DISTINCT FROM needs SQLite 3.39+)
    return `${field} ${distinct ? 'IS NOT' : 'IS'} ${value}`;
  }

  return `${field} ${distinct ? 'IS DISTINCT FROM' : 'IS NOT DISTINCT FROM'} ${value}`;
}

/** Database type of the query builder's connection, e.g. `'postgres'`; undefined without one. */
export function getDriverType(builder: WhereExpressionBuilder): DatabaseType | undefined {
  return (builder as unknown as QueryBuilder<ObjectLiteral>).connection?.driver?.options?.type;
}

/**
 * Quotes one identifier, whatever characters it has: `first-name` → `"first-name"`, a `"` inside is
 * doubled. An already quoted identifier is kept. For names known to be identifiers (columns, aliases).
 */
export const quoteIdentifier = (name: string, driver?: DatabaseType): string => {
  const mysql = isMysqlLikeDriver(driver);
  const quote = mysql ? BACKTICK : '"';

  // only one whole quoted identifier is kept: `"id" * (SELECT …), "id"` starts and ends with a quote too
  if ((mysql ? SINGLE_BACK_QUOTED_IDENTIFIER : SINGLE_DOUBLE_QUOTED_IDENTIFIER).test(name)) {
    return name;
  }

  return `${quote}${name.split(quote).join(quote + quote)}${quote}`;
};

/**
 * Quotes an alias or a table: as a path when it is one (`schema.table` → `"schema"."table"`),
 * otherwise as one identifier (`user-1` → `"user-1"`).
 */
export const quoteIdentifierPath = (path: string, driver?: DatabaseType): string =>
  IDENTIFIER_PATH.test(path) ? stringToSQLIdentifier(path, driver) : quoteIdentifier(path, driver);

/**
 * Quotes an identifier path: `user.id` → `"user"."id"`, `user.*` → `"user".*`.
 * Already quoted segments are kept. Anything that isn't a path of identifiers
 * (`COALESCE(a.x, b.x)`, `LOWER(u.email)`, `u.id::text`, `*`) is returned as is.
 */
export const stringToSQLIdentifier = (
  str: string,
  driver?: DatabaseType
): string => {
  if (!IDENTIFIER_PATH.test(str)) {
    return str;
  }

  const mysql = isMysqlLikeDriver(driver);
  const ownQuote = mysql ? BACKTICK : '"';
  const quote = mysql ? wrapWithBackQoutes : wrapWithDoubleQoutes;

  return (str.match(IDENTIFIER_PATH_SEGMENT) ?? [])
    .map((segment) => {
      if (segment === '*' || segment.startsWith(ownQuote)) {
        return segment;
      }

      // quoted the other way: MySQL reads `"…"` as a string literal with backslash escapes, so it is
      // unquoted and quoted again for the database rather than passed on
      if (segment.startsWith('"') || segment.startsWith(BACKTICK)) {
        const otherQuote = segment[0];
        const name = segment.slice(1, -1).split(otherQuote + otherQuote).join(otherQuote);

        return `${ownQuote}${name.split(ownQuote).join(ownQuote + ownQuote)}${ownQuote}`;
      }

      return quote(segment);
    })
    .join('.');
};

export const stringToSQLValue = (str: string): string => `'${str}'`;

export const createUniqueParameterName = (prefix?: string): string => {
  const uniqueCode = randomString(5);

  return `${prefix || 'param'}_${uniqueCode}`;
};

// a type name, optionally schema-qualified, multi-word (`character varying`), with a
// modifier (`varchar(255)`) and array brackets: `uuid[]`, `public.order_status[]`, `"MyEnum"[]`
const TYPE_NAME_PART = '(?:[A-Za-z_][\\w$]*|"(?:[^"]|"")+")';
const ARRAY_TYPE_PATTERN = new RegExp(
  `^${TYPE_NAME_PART}(?:\\.${TYPE_NAME_PART})*(?: ${TYPE_NAME_PART})*` +
    `(?:\\(\\d+(?:, ?\\d+)?\\))?(?:\\[\\d*\\])*$`
);

/**
 * Returns `arrayType` if it is a type name (`uuid[]`, `public.order_status[]`, `varchar(36)[]`),
 * throws a `TypeError` otherwise: the type is inserted into the SQL as is.
 */
export function assertArrayType(arrayType: string): string {
  if (typeof arrayType !== 'string' || !ARRAY_TYPE_PATTERN.test(arrayType)) {
    throw new TypeError(`Invalid array type "${arrayType}": expected a type name like "uuid[]"`);
  }

  return arrayType;
}
