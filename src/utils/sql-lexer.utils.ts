export const TAB = 9;
export const LINE_FEED = 10;
export const CARRIAGE_RETURN = 13;
export const SPACE = 32;
export const DOUBLE_QUOTE = 34;
export const HASH = 35;
export const DOLLAR = 36;
export const QUOTE = 39;
export const CLOSE_PARENTHESIS = 41;
export const STAR = 42;
export const DASH = 45;
export const DOT = 46;
export const SLASH = 47;
export const COLON = 58;
export const OPEN_BRACKET = 91;
export const BACKSLASH = 92;
export const CLOSE_BRACKET = 93;
export const BACKTICK = 96;

export const isSpace = (code: number): boolean => code === SPACE || (code >= TAB && code <= CARRIAGE_RETURN);

export const isDigit = (code: number): boolean => code >= 48 && code <= 57;

// as PostgreSQL reads identifiers: letters, `_` and every non-ASCII character; then digits and `$` too
export const isIdentifierStart = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95 || code >= 128;

export const isIdentifierPart = (code: number): boolean => isIdentifierStart(code) || isDigit(code) || code === DOLLAR;

/**
 * Index after the string literal whose opening quote is at `start`, closed by the same quote; a doubled quote is one
 * character. `backslashEscapes`: a backslash escapes the next character, as in `E'…'` or a MySQL string.
 */
export function skipString(sql: string, start: number, backslashEscapes: boolean): number {
  const quote = sql.charCodeAt(start);

  for (let i = start + 1; i < sql.length; i++) {
    const code = sql.charCodeAt(i);

    if (backslashEscapes && code === BACKSLASH) {
      i++;
    } else if (code === quote) {
      if (sql.charCodeAt(i + 1) !== quote) {
        return i + 1;
      }

      i++;
    }
  }

  return sql.length;
}

/** Index after the quoted identifier at `start` (`"…"`, `` `…` ``, `[…]`), closed by `close`, doubled to escape it. */
export function skipQuotedIdentifier(sql: string, start: number, close: number): number {
  for (let i = start + 1; i < sql.length; i++) {
    if (sql.charCodeAt(i) === close) {
      if (sql.charCodeAt(i + 1) !== close) {
        return i + 1;
      }

      i++;
    }
  }

  return sql.length;
}

/** Index of the line end after a `--` or `#` comment at `start`. */
export function skipLineComment(sql: string, start: number): number {
  for (let i = start + 1; i < sql.length; i++) {
    const code = sql.charCodeAt(i);

    if (code === LINE_FEED || code === CARRIAGE_RETURN) {
      return i;
    }
  }

  return sql.length;
}

// PostgreSQL nests block comments: `/* a /* b */ c */` is one comment; MySQL and SQLite end it at the first `*/`
export function skipBlockComment(sql: string, start: number, nested = true): number {
  let depth = 0;
  let i = start;

  while (i < sql.length) {
    const code = sql.charCodeAt(i);
    const next = sql.charCodeAt(i + 1);

    if (code === SLASH && next === STAR && (nested || depth === 0)) {
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
export function dollarTagEnd(sql: string, start: number): number {
  let i = start + 1;

  if (isIdentifierStart(sql.charCodeAt(i))) {
    do {
      i++;
    } while (isIdentifierStart(sql.charCodeAt(i)) || isDigit(sql.charCodeAt(i)));
  }

  return sql.charCodeAt(i) === DOLLAR ? i + 1 : -1;
}

/** Index after the `$1` parameter or the dollar-quoted string (`$$…$$`, `$tag$…$tag$`) at `start`. */
export function skipDollar(sql: string, start: number): number {
  const tagEnd = dollarTagEnd(sql, start);

  if (tagEnd === -1) {
    let i = start + 1;

    while (isDigit(sql.charCodeAt(i))) {
      i++;
    }

    return i;
  }

  const close = sql.indexOf(sql.slice(start, tagEnd), tagEnd);

  return close === -1 ? sql.length : close + (tagEnd - start);
}

const SNIPPET_CONTEXT = 30;

/** The SQL around `start`…`end`, on one line, cut at whitespace rather than inside a word when the context has some. */
export function snippetAt(sql: string, start: number, end: number): string {
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
