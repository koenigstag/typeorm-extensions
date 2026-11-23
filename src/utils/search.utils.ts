// no import of query-builder.utils: `typeorm-extensions/helpers` exports escapeLikePattern from here and patches nothing
import type { DatabaseType, WhereExpressionBuilder } from 'typeorm';
import type {
  LikeMatch,
  SimilarityFunction,
  SimilarityScoreOptions,
  TrigramMatchOptions,
  TrigramOperator,
} from '../types/extensions/search.types';
import { getDriverType, isMysqlLikeDriver, isPostgresLikeDriver, isSqliteLikeDriver } from './sql.utils';
import { POSTGRES_RESERVED_KEY_WORDS, toReservedWordSet } from './reserved-qualifier.utils';

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

/** Throws a `TypeError` unless the query runs on PostgreSQL or a database speaking its dialect; a query without a connection passes. */
export function assertTrigramDriver(builder: WhereExpressionBuilder, methodName: string): void {
  const driver = getDriverType(builder);

  // `%` is the modulo operator elsewhere: `col % 'jon'` runs, and matches no row
  if (driver !== undefined && !isPostgresLikeDriver(driver)) {
    throw new TypeError(`${methodName} needs PostgreSQL with pg_trgm, not ${driver}`);
  }
}

/**
 * A column or an expression to compare by trigrams: `sql` as a function argument,
 * `operand` on the left of an operator, in parentheses unless it is a plain column.
 */
export type TrigramColumn = {
  sql: string;
  operand: string;
  /** multiplies the score of the column */
  weight?: number;
};

/** A checked trigram match; its `minScore` is bound to a parameter by the caller. */
export type TrigramMatch = {
  operator: TrigramOperator | false;
  minScore?: number;
  scoreFunction: SimilarityFunction;
  unaccentFunction?: string;
};

const TRIGRAM_OPERATORS: ReadonlyArray<TrigramOperator> = ['%', '%>', '<%', '%>>', '<<%'];

const SCORE_FUNCTIONS: ReadonlyArray<SimilarityFunction> = ['similarity', 'word_similarity', 'strict_word_similarity'];

// the score each operator compares with its threshold, and whether the column is its first argument
const OPERATOR_SCORES: Record<TrigramOperator, { scoreFunction: SimilarityFunction; columnFirst: boolean }> = {
  '%': { scoreFunction: 'similarity', columnFirst: true },
  '%>': { scoreFunction: 'word_similarity', columnFirst: false },
  '<%': { scoreFunction: 'word_similarity', columnFirst: true },
  '%>>': { scoreFunction: 'strict_word_similarity', columnFirst: false },
  '<<%': { scoreFunction: 'strict_word_similarity', columnFirst: true },
};

const DISTANCE_OPERATORS: Record<SimilarityFunction, string> = {
  similarity: '<->',
  word_similarity: '<->>',
  strict_word_similarity: '<->>>',
};

function assertScoreFunction(scoreFunction: unknown, methodName: string): SimilarityFunction {
  if (!SCORE_FUNCTIONS.includes(scoreFunction as SimilarityFunction)) {
    // the function is inserted into the SQL as is
    throw new TypeError(
      `${methodName}: invalid function "${scoreFunction}", expected "similarity", "word_similarity" or "strict_word_similarity"`
    );
  }

  return scoreFunction as SimilarityFunction;
}

/** `value` if it is a finite number, which is written into the SQL as a literal; throws a `TypeError` otherwise. */
export function assertFiniteNumber(value: unknown, name: string, methodName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${methodName}: ${name} must be a finite number, got ${JSON.stringify(value) ?? String(value)}`);
  }

  return value;
}

function assertMinScore(minScore: unknown, methodName: string): number {
  const value = assertFiniteNumber(minScore, 'minScore', methodName);

  if (value < 0 || value > 1) {
    throw new TypeError(`${methodName}: minScore must be between 0 and 1, got ${value}`);
  }

  return value;
}

/** The options of a trigram match, checked: the operator and the function come from closed lists, `minScore` is 0 to 1. */
export function toTrigramMatch(
  options: (TrigramMatchOptions & { unaccent?: boolean | string }) | undefined,
  methodName: string
): TrigramMatch {
  if (options !== undefined && (typeof options !== 'object' || options === null)) {
    throw new TypeError(`${methodName} expects an options object, got ${JSON.stringify(options)}`);
  }

  const {
    operator = '%',
    minScore,
    function: scoreFunction,
    unaccent,
  } = (options ?? {}) as {
    operator?: TrigramOperator | false;
    minScore?: number;
    function?: SimilarityFunction;
    unaccent?: boolean | string;
  };
  const unaccentFunction = toUnaccentFunction(unaccent);

  if (operator === false) {
    if (minScore === undefined) {
      throw new TypeError(`${methodName}: operator: false needs a minScore, the score that matches`);
    }

    return {
      operator,
      minScore: assertMinScore(minScore, methodName),
      scoreFunction: assertScoreFunction(scoreFunction ?? 'similarity', methodName),
      unaccentFunction,
    };
  }

  if (!TRIGRAM_OPERATORS.includes(operator)) {
    // the operator is inserted into the SQL as is
    throw new TypeError(`${methodName}: invalid operator "${operator}", expected "%", "%>", "<%", "%>>", "<<%" or false`);
  }

  if (scoreFunction !== undefined) {
    throw new TypeError(`${methodName}: options.function needs operator: false; an operator compares its own score`);
  }

  return {
    operator,
    minScore: minScore === undefined ? undefined : assertMinScore(minScore, methodName),
    scoreFunction: OPERATOR_SCORES[operator].scoreFunction,
    unaccentFunction,
  };
}

const withFunction = (fn: string | undefined, sql: string): string => (fn ? `${fn}(${sql})` : sql);

/** `similarity(col, :term)`; `word_similarity(:term, col)` and `strict_word_similarity(:term, col)` unless `columnFirst`. */
function buildScoreCall(
  scoreFunction: SimilarityFunction,
  column: string,
  term: string,
  unaccentFunction: string | undefined,
  columnFirst = scoreFunction === 'similarity'
): string {
  const left = withFunction(unaccentFunction, column);
  const right = withFunction(unaccentFunction, term);

  return columnFirst ? `${scoreFunction}(${left}, ${right})` : `${scoreFunction}(${right}, ${left})`;
}

/**
 * The trigram condition of one column, with `term` the parameter of the term and `minScoreParameter` the one bound to
 * `match.minScore`:
 * - `col % :term`, the column on the left, where a trigram index on it applies;
 * - with `minScore`: `(col % :term AND similarity(col, :term) >= :min)`, the score the operator compares;
 * - `operator: false`: `similarity(col, :term) >= :min`.
 */
export function buildTrigramCondition(
  column: TrigramColumn,
  term: string,
  match: TrigramMatch,
  minScoreParameter?: string
): string {
  const { operator, scoreFunction, unaccentFunction } = match;

  if (operator === false) {
    return `${buildScoreCall(scoreFunction, column.sql, term, unaccentFunction)} >= ${minScoreParameter}`;
  }

  const left = unaccentFunction ? withFunction(unaccentFunction, column.sql) : column.operand;
  const condition = `${left} ${operator} ${withFunction(unaccentFunction, term)}`;

  if (minScoreParameter === undefined) {
    return condition;
  }

  const score = buildScoreCall(scoreFunction, column.sql, term, unaccentFunction, OPERATOR_SCORES[operator].columnFirst);

  return `(${condition} AND ${score} >= ${minScoreParameter})`;
}

/**
 * The similarity score of the columns to `term` (a parameter): one column gives `similarity(col, :term)`,
 * a weight multiplies it, `options.combine` joins several, `options.nullScore` replaces a NULL score.
 */
export function buildSimilarityScore(
  columns: readonly TrigramColumn[],
  term: string,
  options: SimilarityScoreOptions | undefined,
  methodName: string
): string {
  const { function: scoreFunction = 'similarity', combine, nullScore, unaccent } = options ?? {};
  const fn = assertScoreFunction(scoreFunction, methodName);
  const unaccentFunction = toUnaccentFunction(unaccent);

  const scores = columns.map((column) => {
    const score = buildScoreCall(fn, column.sql, term, unaccentFunction);

    return column.weight === undefined ? score : `${score} * ${String(column.weight)}`;
  });

  let score: string;

  if (scores.length === 1) {
    [score] = scores;
  } else if (combine === 'greatest') {
    score = `GREATEST(${scores.join(', ')})`;
  } else if (combine === 'sum') {
    // a NULL score would null the whole sum
    score = scores.map((value) => `COALESCE(${value}, 0)`).join(' + ');
  } else if (combine === undefined) {
    throw new TypeError(`${methodName} selects ${scores.length} columns: set options.combine to "greatest" or "sum"`);
  } else {
    throw new TypeError(`${methodName}: invalid combine "${combine}", expected "greatest" or "sum"`);
  }

  return nullScore === undefined
    ? score
    : `COALESCE(${score}, ${String(assertFiniteNumber(nullScore, 'nullScore', methodName))})`;
}

/**
 * The pg_trgm distance of one column to `term`: `col <-> :term`, `<->>` for word similarity, `<->>>` for strict word
 * similarity; the form a GiST `gist_trgm_ops` index on the column orders by.
 */
export function buildSimilarityDistance(
  columns: readonly TrigramColumn[],
  term: string,
  options: SimilarityScoreOptions | undefined,
  methodName: string
): string {
  const { function: scoreFunction = 'similarity', nullScore, unaccent } = options ?? {};
  const fn = assertScoreFunction(scoreFunction, methodName);

  if (columns.length !== 1 || columns[0].weight !== undefined || unaccent || nullScore !== undefined) {
    throw new TypeError(`${methodName}: distance orders by one column, without a weight, unaccent or nullScore`);
  }

  return `${columns[0].operand} ${DISTANCE_OPERATORS[fn]} ${term}`;
}

const ORDER_ALIAS = /^[a-z_][a-z0-9_]*$/;
// PostgreSQL truncates a longer identifier
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Returns `alias` if it can be an ORDER BY key as TypeORM writes it, unquoted: lower case (PostgreSQL folds an unquoted
 * name), at most 63 characters and not a reserved word. Throws a `TypeError` otherwise.
 */
export function assertOrderAlias(alias: unknown, methodName: string): string {
  if (
    typeof alias !== 'string' ||
    !ORDER_ALIAS.test(alias) ||
    alias.length > MAX_IDENTIFIER_LENGTH ||
    toReservedWordSet(POSTGRES_RESERVED_KEY_WORDS).has(alias)
  ) {
    throw new TypeError(
      `${methodName}: invalid alias ${JSON.stringify(alias)}, expected a lower-case identifier of at most 63 characters that isn't a reserved word, such as "score"`
    );
  }

  return alias;
}
