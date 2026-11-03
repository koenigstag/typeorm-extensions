import { DatabaseType } from 'typeorm';
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

  const quote = driver?.includes('mysql')
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
