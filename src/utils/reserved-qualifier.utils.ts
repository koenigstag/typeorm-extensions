/** A reserved word that qualifies a name without quotes, as in `order."userId"`. */
export interface ReservedQualifier {
  /** The word as the SQL has it: `order`, `ORDER`. */
  word: string;
  /** Offset of the word in the SQL. */
  index: number;
  /** The SQL around the word, on one line. */
  snippet: string;
}

/**
 * The reserved key words of PostgreSQL, "reserved" in Appendix C of its documentation (`SYSTEM_USER` since
 * PostgreSQL 16). None can be a table, an alias or a schema without quotes, so none is followed by a `.` in valid
 * SQL. The words "reserved (can be function or type)" (`LEFT`, `JOIN`, `BINARY`, …) aren't on the list: one may
 * name the schema of a type, as in `CAST(x AS binary.my_type)`.
 */
export const POSTGRES_RESERVED_KEY_WORDS: readonly string[] = Object.freeze([
  'ALL', 'ANALYSE', 'ANALYZE', 'AND', 'ANY', 'ARRAY', 'AS', 'ASC', 'ASYMMETRIC', 'BOTH', 'CASE', 'CAST', 'CHECK',
  'COLLATE', 'COLUMN', 'CONSTRAINT', 'CREATE', 'CURRENT_CATALOG', 'CURRENT_DATE', 'CURRENT_ROLE', 'CURRENT_TIME',
  'CURRENT_TIMESTAMP', 'CURRENT_USER', 'DEFAULT', 'DEFERRABLE', 'DESC', 'DISTINCT', 'DO', 'ELSE', 'END', 'EXCEPT',
  'FALSE', 'FETCH', 'FOR', 'FOREIGN', 'FROM', 'GRANT', 'GROUP', 'HAVING', 'IN', 'INITIALLY', 'INTERSECT', 'INTO',
  'LATERAL', 'LEADING', 'LIMIT', 'LOCALTIME', 'LOCALTIMESTAMP', 'NOT', 'NULL', 'OFFSET', 'ON', 'ONLY', 'OR', 'ORDER',
  'PLACING', 'PRIMARY', 'REFERENCES', 'RETURNING', 'SELECT', 'SESSION_USER', 'SOME', 'SYMMETRIC', 'SYSTEM_USER',
  'TABLE', 'THEN', 'TO', 'TRAILING', 'TRUE', 'UNION', 'UNIQUE', 'USER', 'USING', 'VARIADIC', 'WHEN', 'WHERE',
  'WINDOW', 'WITH',
]);

/** The reserved key words of CockroachDB: PostgreSQL's without `SYSTEM_USER`, with `CONCURRENTLY` and `CURRENT_SCHEMA`. */
export const COCKROACHDB_RESERVED_KEY_WORDS: readonly string[] = Object.freeze([
  ...POSTGRES_RESERVED_KEY_WORDS.filter((word) => word !== 'SYSTEM_USER'),
  'CONCURRENTLY',
  'CURRENT_SCHEMA',
]);

const KEY_WORD = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const wordSets = new WeakMap<readonly string[], ReadonlySet<string>>();

/** The words in lower case; cached for a frozen list, such as the defaults, which can't change afterwards. */
export function toReservedWordSet(words: readonly string[]): ReadonlySet<string> {
  const cached = wordSets.get(words);

  if (cached) {
    return cached;
  }

  if (!Array.isArray(words)) {
    throw new TypeError(`Reserved words must be an array of key words, got ${typeof words}`);
  }

  for (const word of words) {
    if (typeof word !== 'string' || !KEY_WORD.test(word)) {
      throw new TypeError(`Invalid reserved word ${JSON.stringify(word)}: expected a key word, such as "order"`);
    }
  }

  const set: ReadonlySet<string> = new Set(words.map((word) => word.toLowerCase()));

  if (Object.isFrozen(words)) {
    wordSets.set(words, set);
  }

  return set;
}

const TAB = 9;
const CARRIAGE_RETURN = 13;
const LINE_FEED = 10;
const SPACE = 32;
const DOUBLE_QUOTE = 34;
const DOLLAR = 36;
const QUOTE = 39;
const STAR = 42;
const DASH = 45;
const DOT = 46;
const SLASH = 47;
const COLON = 58;
const BACKSLASH = 92;

const isSpace = (code: number): boolean => code === SPACE || (code >= TAB && code <= CARRIAGE_RETURN);

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

// as PostgreSQL reads identifiers: letters, `_` and every non-ASCII character; then digits and `$` too
const isIdentifierStart = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95 || code >= 128;

const isIdentifierPart = (code: number): boolean => isIdentifierStart(code) || isDigit(code) || code === DOLLAR;

/** Index after the string literal whose opening quote is at `start`; `E'…'` strings take backslash escapes. */
function skipString(sql: string, start: number, backslashEscapes: boolean): number {
  for (let i = start + 1; i < sql.length; i++) {
    const code = sql.charCodeAt(i);

    if (backslashEscapes && code === BACKSLASH) {
      i++;
    } else if (code === QUOTE) {
      if (sql.charCodeAt(i + 1) !== QUOTE) {
        return i + 1;
      }

      i++;
    }
  }

  return sql.length;
}

function skipQuotedIdentifier(sql: string, start: number): number {
  for (let i = start + 1; i < sql.length; i++) {
    if (sql.charCodeAt(i) === DOUBLE_QUOTE) {
      if (sql.charCodeAt(i + 1) !== DOUBLE_QUOTE) {
        return i + 1;
      }

      i++;
    }
  }

  return sql.length;
}

function skipLineComment(sql: string, start: number): number {
  for (let i = start + 2; i < sql.length; i++) {
    const code = sql.charCodeAt(i);

    if (code === LINE_FEED || code === CARRIAGE_RETURN) {
      return i;
    }
  }

  return sql.length;
}

// PostgreSQL nests block comments: `/* a /* b */ c */` is one comment
function skipBlockComment(sql: string, start: number): number {
  let depth = 0;
  let i = start;

  while (i < sql.length) {
    const code = sql.charCodeAt(i);
    const next = sql.charCodeAt(i + 1);

    if (code === SLASH && next === STAR) {
      depth++;
      i += 2;
    } else if (code === STAR && next === SLASH) {
      depth--;
      i += 2;

      if (depth === 0) {
        return i;
      }
    } else {
      i++;
    }
  }

  return sql.length;
}

/** Index after the opening tag of a dollar-quoted string at `start` (`$$`, `$tag$`); -1 for a parameter (`$1`). */
function dollarTagEnd(sql: string, start: number): number {
  let i = start + 1;

  if (isIdentifierStart(sql.charCodeAt(i))) {
    do {
      i++;
    } while (isIdentifierStart(sql.charCodeAt(i)) || isDigit(sql.charCodeAt(i)));
  }

  return sql.charCodeAt(i) === DOLLAR ? i + 1 : -1;
}

/**
 * Whether the word from `start` to `end` qualifies a name: a dot follows it, after optional whitespace, and not a
 * number (`THEN .5`); and it isn't itself a name after a dot (`public.order.id`), next to a quoted name or an
 * identifier character, or a named parameter (`:order`, but `::` is a cast).
 */
function isQualifier(sql: string, start: number, end: number, previous: number): boolean {
  let next = end;

  while (isSpace(sql.charCodeAt(next))) {
    next++;
  }

  if (sql.charCodeAt(next) !== DOT || isDigit(sql.charCodeAt(next + 1)) || previous === DOT) {
    return false;
  }

  const before = sql.charCodeAt(start - 1);

  return (
    before !== DOUBLE_QUOTE &&
    !isIdentifierPart(before) &&
    !(before === COLON && sql.charCodeAt(start - 2) !== COLON)
  );
}

const SNIPPET_CONTEXT = 30;

// cut at whitespace, not inside a word, when the context has some
function snippetAt(sql: string, start: number, end: number): string {
  let from = Math.max(0, start - SNIPPET_CONTEXT);
  let to = Math.min(sql.length, end + SNIPPET_CONTEXT);

  if (from > 0) {
    const space = sql.slice(from, start).search(/\s/);

    if (space !== -1) {
      from += space + 1;
    }
  }

  if (to < sql.length) {
    const space = sql.slice(end, to).search(/\s\S*$/);

    if (space !== -1) {
      to = end + space;
    }
  }

  return `${from > 0 ? '…' : ''}${sql.slice(from, to).replace(/\s+/g, ' ')}${to < sql.length ? '…' : ''}`;
}

/** `findBareReservedQualifiers` with the words as a set of lower-case words (`toReservedWordSet`). */
export function scanReservedQualifiers(sql: string, words: ReadonlySet<string>): ReservedQualifier[] {
  const found: ReservedQualifier[] = [];
  const length = sql.length;
  // the last character outside whitespace and comments
  let previous = -1;
  let i = 0;

  while (i < length) {
    const code = sql.charCodeAt(i);

    if (isSpace(code)) {
      i++;
    } else if (code === DASH && sql.charCodeAt(i + 1) === DASH) {
      i = skipLineComment(sql, i);
    } else if (code === SLASH && sql.charCodeAt(i + 1) === STAR) {
      i = skipBlockComment(sql, i);
    } else if (code === QUOTE) {
      i = skipString(sql, i, false);
      previous = code;
    } else if (code === DOUBLE_QUOTE) {
      i = skipQuotedIdentifier(sql, i);
      previous = code;
    } else if (code === DOLLAR) {
      const tagEnd = dollarTagEnd(sql, i);

      if (tagEnd === -1) {
        do {
          i++;
        } while (isDigit(sql.charCodeAt(i)));
      } else {
        const close = sql.indexOf(sql.slice(i, tagEnd), tagEnd);

        i = close === -1 ? length : close + (tagEnd - i);
      }

      previous = code;
    } else if (isIdentifierPart(code)) {
      const start = i;

      do {
        i++;
      } while (isIdentifierPart(sql.charCodeAt(i)));

      // E'…', the string literal with backslash escapes
      if (i - start === 1 && (code === 69 || code === 101) && sql.charCodeAt(i) === QUOTE) {
        i = skipString(sql, i, true);
        previous = QUOTE;
        continue;
      }

      if (
        isIdentifierStart(code) &&
        isQualifier(sql, start, i, previous) &&
        words.has(sql.slice(start, i).toLowerCase())
      ) {
        found.push({ word: sql.slice(start, i), index: start, snippet: snippetAt(sql, start, i) });
      }

      previous = code;
    } else {
      previous = code;
      i++;
    }
  }

  return found;
}

/**
 * Reserved words that qualify a name without quotes, as in `order."userId"` or `user.id`: PostgreSQL reads such a
 * word as the key word, not as an alias, and rejects the statement (`syntax error at or near "order"`).
 *
 * Words in string literals (`E'…'` and dollar-quoted ones too), quoted identifiers, comments and parameters are
 * skipped, and so are words after a dot (`public.order`) and a number after one (`THEN .5`). Case-insensitive;
 * whitespace may come before the dot (`group . name`).
 *
 * @param words the words to look for, `POSTGRES_RESERVED_KEY_WORDS` by default
 */
export function findBareReservedQualifiers(
  sql: string,
  words: readonly string[] = POSTGRES_RESERVED_KEY_WORDS
): ReservedQualifier[] {
  return scanReservedQualifiers(sql, toReservedWordSet(words));
}
