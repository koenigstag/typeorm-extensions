import {
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type {
  SimilarityScoreOptions,
  SimilaritySelectors,
  TypedSimilarOptions,
} from '../../../types/extensions/search.types';
import type { WhereMethods } from '../../../types/extensions/where.types';
import { getTypedSingleColumnKey, isColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype, patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { createUniqueParameterName } from '../../../utils/sql.utils';
import {
  assertTrigramDriver,
  buildSimilarityScore,
  buildTrigramCondition,
  toSearchTerm,
  toTrigramMatch,
} from '../../../utils/search.utils';
import { getSearchColumns } from '../../../utils/search-columns.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Trigram similarity conditions (PostgreSQL, `pg_trgm` extension). The column is the left operand,
 * the form a `gin_trgm_ops` / `gist_trgm_ops` index on the column can be used for.
 */
export interface TypedWhereSimilarMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * `options.operator`: `'%'` (default), `'%>'`, `'<%'`, `'%>>'` or `'<<%'`; `options.minScore` also requires the
   * operator's score to reach a value, and `operator: false` compares the score alone.
   * A term shorter than `options.minLength` (default 1, after trimming) adds no condition.
   * Throws a `TypeError` on a database other than PostgreSQL, where `%` is the modulo operator.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;

  /**
   * Adds new AND WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * A blank term adds no condition.
   */
  andWhereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;

  /**
   * Adds new OR WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * A blank term adds no condition.
   */
  orWhereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;
}

/** Trigram similarity score selection (PostgreSQL, `pg_trgm` extension). */
export interface TypedSimilarityScoreMethods<Entity extends ObjectLiteral> {
  /**
   * Adds `similarity(column, :term) AS alias` to the selection (PostgreSQL, pg_trgm).
   * `options.function`: `'similarity'` (default), `'word_similarity'` or `'strict_word_similarity'`
   * (`word_similarity(:term, column)`, the score of `column %> :term`). Several columns need `options.combine`,
   * `{ column, weight }` multiplies a column's score, `options.nullScore` replaces a NULL score.
   * A blank term scores 0. To order by the score, see `orderBySimilarityTyped`; ordering by this alias
   * yourself, use a lower-case one: PostgreSQL folds an unquoted alias in ORDER BY.
   */
  addSimilarityScoreTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selection: SimilaritySelectors<Type>,
    term: string | null | undefined,
    alias: string,
    options?: SimilarityScoreOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereSimilarMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral>
    extends TypedWhereSimilarMethods<Entity>,
      TypedSimilarityScoreMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereSimilarMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereSimilarMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereSimilarMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereSimilarTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): SelectQueryBuilder<Entity> {
    if (typeof where !== 'function') {
      return this;
    }

    const methodName = `${method}SimilarTyped`;
    assertTrigramDriver(this, methodName);
    const column = getTypedSingleColumnKey<Type>(this, where, methodName);
    const match = toTrigramMatch(options, methodName);
    const value = toSearchTerm(term, methodName);
    const minLength = options?.minLength ?? 1;

    if (value === undefined || value.length < minLength) {
      return this;
    }

    const paramName = createUniqueParameterName(method);
    const minScoreParam = match.minScore === undefined ? undefined : createUniqueParameterName('minScore');
    const condition = buildTrigramCondition(
      { sql: column, operand: isColumnKey(column) ? column : `(${column})` },
      `:${paramName}`,
      match,
      minScoreParam && `:${minScoreParam}`
    );

    return this[method](condition, {
      [paramName]: value,
      ...(minScoreParam ? { [minScoreParam]: match.minScore } : {}),
    });
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereSimilarTyped: createWhereSimilarTypedMethod('where'),
    andWhereSimilarTyped: createWhereSimilarTypedMethod('andWhere'),
    orWhereSimilarTyped: createWhereSimilarTypedMethod('orWhere'),
  },
};

const scoreExtension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    addSimilarityScoreTyped: function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
      this: SelectQueryBuilder<Entity>,
      selection: SimilaritySelectors<Type>,
      term: string | null | undefined,
      alias: string,
      options?: SimilarityScoreOptions
    ): SelectQueryBuilder<Entity> {
      const methodName = 'addSimilarityScoreTyped';
      assertTrigramDriver(this, methodName);
      const columns = getSearchColumns<Type>(this, selection, methodName, true);

      if (typeof alias !== 'string' || alias.length === 0) {
        throw new TypeError(`${methodName} expects an alias for the score`);
      }

      // always select the score, a query may order by its alias: a blank term scores 0
      const value = toSearchTerm(term, methodName) ?? '';
      const paramName = createUniqueParameterName('similarity');
      const expression = buildSimilarityScore(columns, `:${paramName}`, options, methodName);

      return this.addSelect(expression, alias).setParameter(paramName, value);
    },
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

patchPrototype(SelectQueryBuilder, scoreExtension);
