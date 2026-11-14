import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type {
  SearchSelector,
  TypedILikeOptions,
  TypedSearchOptions,
} from '../../../types/extensions/search.types';
import type { WhereMethods } from '../../../types/extensions/where.types';
import { getTypedColumnKey, getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { createUniqueParameterName, getDriverType } from '../../../utils/sql.utils';
import {
  buildILikeCondition,
  toLikePattern,
  toSearchTerm,
  toUnaccentFunction,
} from '../../../utils/search.utils';
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
   * one group, one parameter for every column. A selector is a typed callback (it may select
   * several columns) or a raw expression `{ sql: '…' }`, which is put in parentheses.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: ReadonlyArray<SearchSelector<Type>>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): this;

  /**
   * Adds new AND WHERE `(col1 ILIKE :pattern OR col2 ILIKE :pattern …)` condition in the query builder.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   */
  andWhereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: ReadonlyArray<SearchSelector<Type>>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): this;

  /**
   * Adds new OR WHERE `(col1 ILIKE :pattern OR col2 ILIKE :pattern …)` condition in the query builder.
   * A value shorter than `options.minLength` (default 1, after trimming) adds no condition.
   */
  orWhereSearchTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selectors: ReadonlyArray<SearchSelector<Type>>,
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
    const column = getTypedSingleColumnKey<Type>(this, where, methodName);
    const term = toSearchTerm(value, methodName);

    if (term === undefined) {
      return this;
    }

    return attachILike(this, method, [column], term, options);
  };

const createWhereSearchTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    selectors: ReadonlyArray<SearchSelector<Type>>,
    value: string | null | undefined,
    options?: TypedSearchOptions
  ): SelectQueryBuilder<Entity> {
    const methodName = `${method}SearchTyped`;
    // resolve the columns first: a wrong selector throws even for a blank value
    const columns = getSearchColumns<Type>(this, selectors, methodName);
    const term = toSearchTerm(value, methodName);
    const minLength = options?.minLength ?? 1;

    if (term === undefined || term.length < minLength) {
      return this;
    }

    return attachILike(this, method, columns, term, options);
  };

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

/** Quoted columns and raw expressions of the search selectors, in order. */
function getSearchColumns<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  selectors: ReadonlyArray<SearchSelector<Type>>,
  methodName: string
): string[] {
  if (!Array.isArray(selectors) || selectors.length === 0) {
    // no columns to search in: matching nothing or everything silently would hide the bug
    throw new TypeError(`${methodName} expects a non-empty array of columns to search in`);
  }

  return selectors.flatMap((selector) => {
    if (typeof selector === 'function') {
      return getTypedColumnKey<Type>(builder, selector);
    }

    if (selector && typeof selector === 'object' && typeof selector.sql === 'string' && selector.sql.trim()) {
      // in parentheses: the expression may have operators that bind looser than ILIKE
      return `(${selector.sql})`;
    }

    throw new TypeError(`${methodName} expects a typed callback or { sql: string }, got ${JSON.stringify(selector)}`);
  });
}

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
