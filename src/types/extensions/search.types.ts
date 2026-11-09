import type { ObjectLiteral } from 'typeorm';
import type { KeyProxyCallback } from '../modules/proxy-callback.types';

/**
 * Where the search value must be found in the column:
 * - `'contains'` → `%value%`;
 * - `'prefix'` → `value%`;
 * - `'suffix'` → `%value`;
 * - `'exact'` → `value` (a case-insensitive equality).
 */
export type LikeMatch = 'contains' | 'prefix' | 'suffix' | 'exact';

/** A raw SQL expression to search in, used as is in parentheses: `{ sql: \`u."firstName" || ' ' || u."lastName"\` }`. */
export type SqlExpression = { sql: string };

/** A column (typed callback, may select several columns) or a raw SQL expression to search in. */
export type SearchSelector<Type extends ObjectLiteral> = KeyProxyCallback<Type> | SqlExpression;

export type TypedILikeOptions = {
  /** Where the value must be found in the column. Defaults to `'contains'`. */
  match?: LikeMatch;
  /**
   * Escape `%`, `_` and `\` in the value with a backslash, so they match themselves.
   * Defaults to `true`; `false` passes the value's own wildcards through.
   */
  escape?: boolean;
  /**
   * Compare without accents (PostgreSQL `unaccent` extension): `unaccent(col) ILIKE unaccent(:p)`.
   * `true` calls `unaccent`; a string names the function to call, e.g. an IMMUTABLE wrapper
   * that an expression index is built on: `'immutable_unaccent'`, `'public.f_unaccent'`.
   */
  unaccent?: boolean | string;
};

export type TypedSearchOptions = TypedILikeOptions & {
  /** A value shorter than this (after trimming) adds no condition. Defaults to 1. */
  minLength?: number;
};

export type TypedLowerOptions = {
  /**
   * Wraps both the column and the parameter: `(sql) => \`LOWER(TRIM(${sql}))\``.
   * Defaults to `(sql) => \`LOWER(${sql})\``. Write it exactly like the expression index
   * the condition should use. The result must contain `sql`.
   */
  normalize?: (sql: string) => string;
};

/**
 * pg_trgm operator, with the column on the left:
 * - `'%'` → `col % :term`: `similarity(col, term)` is above `pg_trgm.similarity_threshold`;
 * - `'%>'` → `col %> :term` (same as `:term <% col`): the term is similar to a word of the column,
 *   `word_similarity(term, col)` is above `pg_trgm.word_similarity_threshold`;
 * - `'<%'` → `col <% :term`: the column is similar to a word of the term.
 *
 * `%` and `%>` can use a `gin_trgm_ops` / `gist_trgm_ops` index on the column, `<%` can't.
 */
export type TrigramOperator = '%' | '%>' | '<%';

export type TypedSimilarOptions = {
  /** Defaults to `'%'`. */
  operator?: TrigramOperator;
};

/**
 * pg_trgm score function:
 * - `'similarity'` → `similarity(col, :term)`, pairs with the `%` operator;
 * - `'word_similarity'` → `word_similarity(:term, col)`, pairs with `%>`;
 * - `'strict_word_similarity'` → `strict_word_similarity(:term, col)`.
 */
export type SimilarityFunction = 'similarity' | 'word_similarity' | 'strict_word_similarity';

export type SimilarityScoreOptions = {
  /** Defaults to `'similarity'`. */
  function?: SimilarityFunction;
};
