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

/** One callback selecting the columns, `q => [q.name, q.email]`, or a list of selectors. */
export type SearchSelectors<Type extends ObjectLiteral> = KeyProxyCallback<Type> | ReadonlyArray<SearchSelector<Type>>;

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
 * - `'%'` → `col % :term`: `similarity(col, term)` is above `pg_trgm.similarity_threshold` (0.3);
 * - `'%>'` → `col %> :term` (same as `:term <% col`): the term is similar to a word of the column,
 *   `word_similarity(term, col)` is above `pg_trgm.word_similarity_threshold` (0.6);
 * - `'<%'` → `col <% :term`: the column is similar to a word of the term;
 * - `'%>>'` → `col %>> :term` (same as `:term <<% col`): the term is similar to whole words of the column,
 *   `strict_word_similarity(term, col)` is above `pg_trgm.strict_word_similarity_threshold` (0.5);
 * - `'<<%'` → `col <<% :term`: the column is similar to whole words of the term.
 *
 * `%`, `%>` and `%>>` can use a `gin_trgm_ops` / `gist_trgm_ops` index on the column, `<%` and `<<%` can't.
 */
export type TrigramOperator = '%' | '%>' | '<%' | '%>>' | '<<%';

/**
 * pg_trgm score function:
 * - `'similarity'` → `similarity(col, :term)`, pairs with the `%` operator;
 * - `'word_similarity'` → `word_similarity(:term, col)`, pairs with `%>`;
 * - `'strict_word_similarity'` → `strict_word_similarity(:term, col)`, pairs with `%>>`.
 */
export type SimilarityFunction = 'similarity' | 'word_similarity' | 'strict_word_similarity';

/** How a column matches a term by its trigrams: an operator, optionally with a score cutoff, or the score alone. */
export type TrigramMatchOptions =
  | {
      /** Defaults to `'%'`. */
      operator?: TrigramOperator;
      /**
       * Also requires the operator's score to reach this value, 0 to 1:
       * `(col % :term AND similarity(col, :term) >= :min)`. The operator filters at its session threshold
       * first, so a value below that threshold changes nothing: see `operator: false`.
       */
      minScore?: number;
      /** Only with `operator: false`: an operator compares its own score. */
      function?: never;
    }
  | {
      /** No operator: the score alone decides, `similarity(col, :term) >= :min`. A trigram index can't serve it. */
      operator: false;
      /** The lowest score that matches, 0 to 1. */
      minScore: number;
      /** The score to compare. Defaults to `'similarity'`. */
      function?: SimilarityFunction;
    };

export type TypedSimilarOptions = TrigramMatchOptions & {
  /**
   * Compare without accents (PostgreSQL `unaccent` extension): `unaccent(col) % unaccent(:term)`.
   * `true` calls `unaccent`; a string names the function, e.g. an IMMUTABLE wrapper an expression index is built on.
   */
  unaccent?: boolean | string;
  /** A term shorter than this (after trimming) adds no condition. Defaults to 1. */
  minLength?: number;
};

export type TypedSearchOptions = TypedILikeOptions & {
  /** A value shorter than this (after trimming) adds no condition. Defaults to 1. */
  minLength?: number;
  /**
   * Also match the columns trigram-similar to the value, in the same OR group (PostgreSQL, pg_trgm):
   * `(col ILIKE :pattern OR col % :term)`. `true` uses `%`; an object takes the options of `whereSimilarTyped`.
   */
  similar?: boolean | TrigramMatchOptions;
  /** `false` leaves out the ILIKE conditions, so only `similar` matches. Defaults to `true`. */
  substring?: boolean;
};

/** A selector whose score is multiplied by `weight`: `{ column: (p) => p.name, weight: 2 }`. */
export type WeightedSearchSelector<Type extends ObjectLiteral> = {
  column: SearchSelector<Type>;
  weight: number;
};

/** One callback selecting the columns, `p => [p.name, p.sku]`, or a list of selectors, each optionally weighted. */
export type SimilaritySelectors<Type extends ObjectLiteral> =
  | KeyProxyCallback<Type>
  | ReadonlyArray<SearchSelector<Type> | WeightedSearchSelector<Type>>;

export type SimilarityScoreOptions = {
  /** Defaults to `'similarity'`. */
  function?: SimilarityFunction;
  /**
   * How the scores of several columns combine, required for more than one column:
   * `'greatest'` → `GREATEST(s1, s2)`, which skips NULL scores; `'sum'` → `COALESCE(s1, 0) + COALESCE(s2, 0)`.
   */
  combine?: 'greatest' | 'sum';
  /** The score of a row whose columns are all NULL: `COALESCE(score, nullScore)`. NULL without it. */
  nullScore?: number;
  /** Compare without accents: `similarity(unaccent(col), unaccent(:term))`; a string names the function. */
  unaccent?: boolean | string;
};

export type SimilarityOrderOptions = SimilarityScoreOptions & {
  /** Alias of the selected score: a lower-case identifier that isn't a reserved word. Generated when omitted. */
  alias?: string;
  /** Defaults to `'DESC'`, the most similar first; `'ASC'` with `distance`. */
  direction?: 'ASC' | 'DESC';
  /** Defaults to `'last'`: rows without text to compare come after every match. */
  nulls?: 'first' | 'last';
  /**
   * Orders by the pg_trgm distance operator instead of the score: `col <-> :term ASC` (`<->>` for
   * `function: 'word_similarity'`, `<->>>` for `'strict_word_similarity'`). With LIMIT, a GiST
   * `gist_trgm_ops` index on the column returns the nearest rows first. One column, without weights,
   * `unaccent` or `nullScore`.
   */
  distance?: boolean;
};
