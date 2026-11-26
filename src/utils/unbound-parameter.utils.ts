import type { DatabaseType } from 'typeorm';
import {
  BACKTICK,
  CLOSE_BRACKET,
  CLOSE_PARENTHESIS,
  COLON,
  DASH,
  DOLLAR,
  DOT,
  DOUBLE_QUOTE,
  HASH,
  isDigit,
  isIdentifierPart,
  isSpace,
  OPEN_BRACKET,
  QUOTE,
  skipBlockComment,
  skipDollar,
  skipLineComment,
  skipQuotedIdentifier,
  skipString,
  SLASH,
  snippetAt,
  STAR,
} from './sql-lexer.utils';
import { isMysqlLikeDriver, isPostgresLikeDriver } from './sql.utils';

/** A `:name` / `:...name` parameter left in the SQL of a query without a value. */
export interface UnboundParameter {
  /** The name of the parameter, without the `:` / `:...`: `id`. */
  name: string;
  /** Written as a list, `:...ids`. */
  spread: boolean;
  /** Offset of the `:` in the SQL. */
  index: number;
  /** The SQL around the parameter, on one line. */
  snippet: string;
}

/**
 * How the SQL is read: `postgres` (`$$…$$` strings, `E'…'`, nested comments, `tags[1:n]` slices); `mysql` (MySQL,
 * MariaDB, Spanner: `'…'` and `"…"` strings with backslash escapes, `` `…` `` names, `#` comments); `default`
 * (SQLite, SQL Server, Oracle, SAP HANA: `'…'` strings, `"…"`, `` `…` `` and `[…]` names).
 */
export type SqlDialect = 'postgres' | 'mysql' | 'default';

export const toSqlDialect = (driver?: DatabaseType): SqlDialect =>
  isPostgresLikeDriver(driver) ? 'postgres' : isMysqlLikeDriver(driver) || driver === 'spanner' ? 'mysql' : 'default';

// as TypeORM reads a parameter name: `/:(\.\.\.)?([A-Za-z0-9_.]+)/`; one that starts with a digit is Oracle's `:1`
const isParameterStart = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95;

const isParameterPart = (code: number): boolean => isParameterStart(code) || isDigit(code) || code === DOT;

/**
 * On PostgreSQL, whether a `[` after `previous` opens a subscript (`tags[1:n]`, `(…)[1]`, `"tags"[2]`), where `:n` is
 * a slice bound, not a parameter; `ARRAY[:a, :b]` builds an array of values.
 */
const opensSubscript = (previous: number, previousWord: string): boolean =>
  previous === DOUBLE_QUOTE ||
  previous === CLOSE_PARENTHESIS ||
  previous === CLOSE_BRACKET ||
  (isIdentifierPart(previous) && previousWord.toLowerCase() !== 'array');

/** `findUnboundParameters` with the dialect of the database (`toSqlDialect`). */
export function scanUnboundParameters(sql: string, dialect: SqlDialect): UnboundParameter[] {
  const found: UnboundParameter[] = [];
  const postgres = dialect === 'postgres';
  const mysql = dialect === 'mysql';
  const length = sql.length;
  // PostgreSQL: whether each open `[` is a subscript
  const brackets: boolean[] = [];
  // the last character outside whitespace and comments, and the last word
  let previous = -1;
  let previousWord = '';
  let i = 0;

  while (i < length) {
    const code = sql.charCodeAt(i);
    const next = sql.charCodeAt(i + 1);

    if (isSpace(code)) {
      i++;
    } else if ((code === DASH && next === DASH) || (mysql && code === HASH)) {
      i = skipLineComment(sql, i);
    } else if (code === SLASH && next === STAR) {
      i = skipBlockComment(sql, i, postgres);
    } else if (code === QUOTE || (mysql && code === DOUBLE_QUOTE)) {
      i = skipString(sql, i, mysql);
      previous = QUOTE;
    } else if (code === DOUBLE_QUOTE || (!postgres && code === BACKTICK)) {
      i = skipQuotedIdentifier(sql, i, code);
      previous = DOUBLE_QUOTE;
    } else if (dialect === 'default' && code === OPEN_BRACKET) {
      i = skipQuotedIdentifier(sql, i, CLOSE_BRACKET);
      previous = DOUBLE_QUOTE;
    } else if (postgres && code === DOLLAR) {
      i = skipDollar(sql, i);
      previous = sql.charCodeAt(i - 1);
      previousWord = '';
    } else if (postgres && code === OPEN_BRACKET) {
      brackets.push(opensSubscript(previous, previousWord));
      previous = code;
      i++;
    } else if (postgres && code === CLOSE_BRACKET) {
      brackets.pop();
      previous = code;
      i++;
    } else if (code === COLON) {
      // `::text`, a cast
      if (next === COLON) {
        previous = code;
        i += 2;
        continue;
      }

      const spread = next === DOT && sql.startsWith('...', i + 1);
      const nameStart = spread ? i + 4 : i + 1;
      const isSliceBound = !spread && brackets.length > 0 && brackets[brackets.length - 1];

      if (!isParameterStart(sql.charCodeAt(nameStart)) || isSliceBound) {
        previous = code;
        i++;
        continue;
      }

      let end = nameStart;

      do {
        end++;
      } while (isParameterPart(sql.charCodeAt(end)));

      found.push({ name: sql.slice(nameStart, end), spread, index: i, snippet: snippetAt(sql, i, end) });
      previous = sql.charCodeAt(end - 1);
      previousWord = '';
      i = end;
    } else if (isIdentifierPart(code)) {
      const start = i;

      do {
        i++;
      } while (isIdentifierPart(sql.charCodeAt(i)));

      // E'…', the string literal with backslash escapes
      if (postgres && i - start === 1 && (code === 69 || code === 101) && sql.charCodeAt(i) === QUOTE) {
        i = skipString(sql, i, true);
        previous = QUOTE;
        continue;
      }

      previous = code;
      previousWord = sql.slice(start, i);
    } else {
      previous = code;
      i++;
    }
  }

  return found;
}

/**
 * The `:name` and `:...name` parameters left in SQL that TypeORM has filled in with the values of its parameters
 * (`getSql()`, `getQueryAndParameters()`): a parameter TypeORM has no value for stays in the SQL as written, and the
 * database rejects the query (`syntax error at or near ":"` on PostgreSQL).
 *
 * Skips `::` casts, names that start with a digit (Oracle's own `:1`), and everything inside string literals, quoted
 * names and comments, as the database reads them; on PostgreSQL, a slice bound in a subscript too (`tags[1:n]`).
 *
 * @param driver the database the SQL is for, which decides how literals and comments are read; PostgreSQL by default
 */
export function findUnboundParameters(sql: string, driver: DatabaseType = 'postgres'): UnboundParameter[] {
  return scanUnboundParameters(sql, toSqlDialect(driver));
}
