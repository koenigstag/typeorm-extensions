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

  if (name.length >= 2 && name.startsWith(quote) && name.endsWith(quote)) {
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

  const quote = isMysqlLikeDriver(driver)
    ? wrapWithBackQoutes
    : wrapWithDoubleQoutes;

  return (str.match(IDENTIFIER_PATH_SEGMENT) ?? [])
    .map((segment) =>
      segment === '*' || segment.startsWith('"') || segment.startsWith(BACKTICK)
        ? segment
        : quote(segment)
    )
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
