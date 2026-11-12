import {
  ObjectLiteral,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type {
  SimilarityFunction,
  SimilarityScoreOptions,
  TrigramOperator,
  TypedSimilarOptions,
} from '../../../types/extensions/search.types';
import type { WhereMethods } from '../../../types/extensions/where.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { createUniqueParameterName } from '../../../utils/sql.utils';
import { toSearchTerm } from '../../../utils/search.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Trigram similarity conditions (PostgreSQL, `pg_trgm` extension). The column is the left operand,
 * the form a `gin_trgm_ops` / `gist_trgm_ops` index on the column can be used for.
 */
export interface TypedWhereSimilarMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * `options.operator`: `'%'` (default), `'%>'` (`column %> :term`, same as `:term <% column`)
   * or `'<%'` (`column <% :term`, can't use an index). A blank term adds no condition.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;

  /**
   * Adds new AND WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * A blank term adds no condition.
   */
  andWhereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;

  /**
   * Adds new OR WHERE `column % :term` condition in the query builder (PostgreSQL, pg_trgm).
   * A blank term adds no condition.
   */
  orWhereSimilarTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    term: string | null | undefined,
    options?: TypedSimilarOptions
  ): this;
}

/** Trigram similarity score selection (PostgreSQL, `pg_trgm` extension). */
export interface TypedSimilarityScoreMethods<Entity extends ObjectLiteral> {
  /**
   * Adds `similarity(column, :term) AS alias` to the selection (PostgreSQL, pg_trgm), to order by:
   * `.addSimilarityScoreTyped(u => u.name, term, 'score').orderBy('score', 'DESC')`.
   * `options.function`: `'similarity'` (default), `'word_similarity'` or `'strict_word_similarity'`
   * (`word_similarity(:term, column)`, the score of `column %> :term`).
   * Use a lower-case alias: PostgreSQL folds an unquoted alias in ORDER BY.
   */
  addSimilarityScoreTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
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

const TRIGRAM_OPERATORS: ReadonlyArray<TrigramOperator> = ['%', '%>', '<%'];

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
    const column = getTypedSingleColumnKey<Type>(this, where, methodName);
    const { operator = '%' } = options ?? {};

    if (!TRIGRAM_OPERATORS.includes(operator)) {
      // the operator is inserted into the SQL as is
      throw new TypeError(`${methodName}: invalid operator "${operator}", expected "%", "%>" or "<%"`);
    }

    const value = toSearchTerm(term, methodName);

    if (value === undefined) {
      return this;
    }

    const paramName = createUniqueParameterName(method);

    // the column on the left: `col % :term`, `col %> :term` can use a trigram index on `col`
    return this[method](`${column} ${operator} :${paramName}`, { [paramName]: value });
  };

const SCORE_FUNCTIONS: ReadonlyArray<SimilarityFunction> = [
  'similarity',
  'word_similarity',
  'strict_word_similarity',
];

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
      selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      term: string | null | undefined,
      alias: string,
      options?: SimilarityScoreOptions
    ): SelectQueryBuilder<Entity> {
      const methodName = 'addSimilarityScoreTyped';
      const column = getTypedSingleColumnKey<Type>(this, selection, methodName);
      const { function: scoreFunction = 'similarity' } = options ?? {};

      if (!SCORE_FUNCTIONS.includes(scoreFunction)) {
        throw new TypeError(
          `${methodName}: invalid function "${scoreFunction}", expected "similarity", "word_similarity" or "strict_word_similarity"`
        );
      }

      if (typeof alias !== 'string' || alias.length === 0) {
        throw new TypeError(`${methodName} expects an alias for the score`);
      }

      // always select the score, a query may order by its alias: a blank term scores 0
      const value = toSearchTerm(term, methodName) ?? '';
      const paramName = createUniqueParameterName('similarity');
      const expression =
        scoreFunction === 'similarity'
          ? `similarity(${column}, :${paramName})`
          : `${scoreFunction}(:${paramName}, ${column})`;

      return this.addSelect(expression, alias).setParameter(paramName, value);
    },
  },
};

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SoftDeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});

patchPrototype(SelectQueryBuilder, scoreExtension);
