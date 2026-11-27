import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type {
  SearchSelectors,
  TypedILikeOptions,
  TypedSearchOptions,
} from '../../../types/extensions/search.types';
import type { WhereMethods } from '../../../types/extensions/where.types';
import { getTypedConditionKey } from '../../../utils/query-builder.utils';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { createUniqueParameterName, getDriverType } from '../../../utils/sql.utils';
import {
  assertTrigramDriver,
  buildILikeCondition,
  buildTrigramCondition,
  toLikePattern,
  toSearchTerm,
  toTrigramMatch,
  toUnaccentFunction,
  TrigramColumn,
  TrigramMatch,
} from '../../../utils/search.utils';
import { getSearchColumns } from '../../../utils/search-columns.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Case-insensitive search methods: `ILIKE` on PostgreSQL, `LIKE` on MySQL / MariaDB and SQLite.
 * `%`, `_` and `\` in the value are escaped, and a blank value adds no condition.
 */
export interface TypedWhereILikeMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column ILIKE :pattern` condition in the query builder,
   * `%value%` by default (`options.match`). `%`, `_` and `\` in the value match themselves.
   * `null`, `undefined` or a blank value adds no condition (previous conditions are kept).
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereILikeTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedILikeOptions
  ): this;

  /**
   * Adds new AND WHERE `column ILIKE :pattern` condition in the query builder.
   * `null`, `undefined` or a blank value adds no condition.
   */
  andWhereILikeTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedILikeOptions
  ): this;

  /**
   * Adds new OR WHERE `column ILIKE :pattern` condition in the query builder.
   * `null`, `undefined` or a blank value adds no condition.
   */
  orWhereILikeTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedILikeOptions
  ): this;

  /**
   * Sets WHERE `(col1 ILIKE :pattern OR col2 ILIKE :pattern …)` condition in the query builder:
   * one group, one parameter for every column. Takes one callback, `q => [q.name, q.email]`, or a list
   * of selectors: a typed callback (it may select several columns) or a raw expression `{ sql: '…' }`,
   * which is put in parentheses.
   * `options.similar` adds a trigram condition per column to the group (PostgreSQL, pg_trgm):
   * `(col1 ILIKE :pattern OR col1 % :term …)`; `options.substring: false` leaves the ILIKE ones out.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: SearchSelectors<Type>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): this;

  /**
   * Adds new AND WHERE `(col1 ILIKE :pattern OR col2 ILIKE :pattern …)` condition in the query builder.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   */
  andWhereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: SearchSelectors<Type>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): this;

  /**
   * Adds new OR WHERE `(col1 ILIKE :pattern OR col2 ILIKE :pattern …)` condition in the query builder.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   */
  orWhereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: SearchSelectors<Type>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereILikeMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereILikeMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereILikeMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereILikeMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereILikeMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereILikeTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedILikeOptions
  ): SelectQueryBuilder<Entity> {
    if (typeof where !== 'function') {
      return this;
    }

    const methodName = `${method}ILikeTyped`;
    // resolve the column first: a wrong selector throws even for a blank value
    const column = getTypedConditionKey<Type>(this, where, methodName);
    const term = toSearchTerm(value, methodName);

    if (term === undefined) {
      return this;
    }

    return attachILike(this, method, [column], term, options);
  };

const createWhereSearchTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    selectors: SearchSelectors<Type>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): SelectQueryBuilder<Entity> {
    const methodName = `${method}SearchTyped`;
    const similarMatch = toSimilarMatch(options?.similar, methodName);
    const substring = options?.substring ?? true;

    if (similarMatch) {
      assertTrigramDriver(this, methodName);
    }

    if (!substring && !similarMatch) {
      throw new TypeError(`${methodName}: substring: false without similar leaves nothing to match`);
    }

    // resolve the columns first: a wrong selector throws even for a blank value
    const columns = getSearchColumns<Type>(this, selectors, methodName);
    const term = toSearchTerm(value, methodName);
    const minLength = options?.minLength ?? 1;

    if (term === undefined || term.length < minLength) {
      return this;
    }

    if (!similarMatch) {
      return attachILike(
        this,
        method,
        columns.map((column) => column.sql),
        term,
        options
      );
    }

    return attachSearch(this, method, columns, term, similarMatch, substring, options);
  };

/** The trigram match of `options.similar`: `true` is `%`, an object is checked; `undefined` for none. */
function toSimilarMatch(similar: TypedSearchOptions['similar'], methodName: string): TrigramMatch | undefined {
  if (similar === undefined || similar === false) {
    return undefined;
  }

  if (similar === true) {
    return toTrigramMatch(undefined, methodName);
  }

  if (typeof similar !== 'object' || similar === null) {
    throw new TypeError(`${methodName}: options.similar is a boolean or an options object, got ${JSON.stringify(similar)}`);
  }

  // unaccent is an option of the whole search, for both conditions
  return toTrigramMatch({ ...similar, unaccent: undefined }, methodName);
}

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereILikeTyped: createWhereILikeTypedMethod('where'),
    andWhereILikeTyped: createWhereILikeTypedMethod('andWhere'),
    orWhereILikeTyped: createWhereILikeTypedMethod('orWhere'),
    whereSearchTyped: createWhereSearchTypedMethod('where'),
    andWhereSearchTyped: createWhereSearchTypedMethod('andWhere'),
    orWhereSearchTyped: createWhereSearchTypedMethod('orWhere'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

/**
 * `column ILIKE :pattern` for one column, `(col1 ILIKE :pattern OR col2 ILIKE :pattern)` for several:
 * all the columns share one parameter.
 */
function attachILike<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  columns: string[],
  term: string,
  options: TypedILikeOptions | undefined
): QB {
  const { match = 'contains', escape = true, unaccent } = options ?? {};

  const pattern = toLikePattern(term, match, escape);
  const unaccentFunction = toUnaccentFunction(unaccent);
  const driver = getDriverType(builder);
  const paramName = createUniqueParameterName(method);

  const conditions = columns.map((column) =>
    buildILikeCondition(driver, column, `:${paramName}`, unaccentFunction)
  );
  const condition = conditions.length === 1 ? conditions[0] : `(${conditions.join(' OR ')})`;

  return builder[method](condition, { [paramName]: pattern });
}

/**
 * `(col1 ILIKE :pattern OR col1 % :term OR col2 ILIKE :pattern OR col2 % :term)`: the escaped pattern and the raw
 * term are two parameters shared by every column, and `minScore` a third.
 */
function attachSearch<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  columns: TrigramColumn[],
  term: string,
  similarMatch: TrigramMatch,
  substring: boolean,
  options: TypedSearchOptions | undefined
): QB {
  const { match = 'contains', escape = true, unaccent } = options ?? {};
  const unaccentFunction = toUnaccentFunction(unaccent);
  const driver = getDriverType(builder);
  const trigramMatch: TrigramMatch = { ...similarMatch, unaccentFunction };

  const patternParam = createUniqueParameterName(method);
  const termParam = createUniqueParameterName(method);
  const minScoreParam = similarMatch.minScore === undefined ? undefined : createUniqueParameterName('minScore');

  const conditions = columns.flatMap((column) => [
    ...(substring ? [buildILikeCondition(driver, column.sql, `:${patternParam}`, unaccentFunction)] : []),
    buildTrigramCondition(column, `:${termParam}`, trigramMatch, minScoreParam && `:${minScoreParam}`),
  ]);
  const condition = conditions.length === 1 ? conditions[0] : `(${conditions.join(' OR ')})`;

  return builder[method](condition, {
    [termParam]: term,
    ...(substring ? { [patternParam]: toLikePattern(term, match, escape) } : {}),
    ...(minScoreParam ? { [minScoreParam]: similarMatch.minScore } : {}),
  });
}
