import {
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type { TypedLowerOptions } from '../../../types/extensions/search.types';
import type { WhereMethods } from '../../../types/extensions/where.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { createUniqueParameterName } from '../../../utils/sql.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Case-insensitive equality: `LOWER(column) = LOWER(:value)`. `options.normalize` changes the
 * wrapping of both sides, e.g. `(sql) => \`LOWER(TRIM(${sql}))\``, to match an expression index.
 */
export interface TypedWhereLowerMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `LOWER(column) = LOWER(:value)` condition in the query builder.
   * `null` / `undefined` matches nothing (`FALSE`).
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereLowerEqualsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedLowerOptions
  ): this;

  /**
   * Adds new AND WHERE `LOWER(column) = LOWER(:value)` condition in the query builder.
   * `null` / `undefined` matches nothing (`FALSE`).
   */
  andWhereLowerEqualsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedLowerOptions
  ): this;

  /**
   * Adds new OR WHERE `LOWER(column) = LOWER(:value)` condition in the query builder.
   * `null` / `undefined` matches nothing (`FALSE`).
   */
  orWhereLowerEqualsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedLowerOptions
  ): this;

  /**
   * Sets WHERE `LOWER(column) IN (LOWER(:v1), LOWER(:v2), …)` condition in the query builder.
   * An empty or missing array matches nothing (`FALSE`), like `whereIsIn`.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsInLowerTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ReadonlyArray<string> | null | undefined,
    options?: TypedLowerOptions
  ): this;

  /**
   * Adds new AND WHERE `LOWER(column) IN (LOWER(:v1), LOWER(:v2), …)` condition in the query builder.
   * An empty or missing array matches nothing (`FALSE`).
   */
  andWhereIsInLowerTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ReadonlyArray<string> | null | undefined,
    options?: TypedLowerOptions
  ): this;

  /**
   * Adds new OR WHERE `LOWER(column) IN (LOWER(:v1), LOWER(:v2), …)` condition in the query builder.
   * An empty or missing array matches nothing (`FALSE`).
   */
  orWhereIsInLowerTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ReadonlyArray<string> | null | undefined,
    options?: TypedLowerOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereLowerMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereLowerMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereLowerMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereLowerMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereLowerMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereLowerEqualsTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: string | null | undefined,
    options?: TypedLowerOptions
  ): SelectQueryBuilder<Entity> {
    if (typeof where !== 'function') {
      return this;
    }

    const methodName = `${method}LowerEqualsTyped`;
    const column = getTypedSingleColumnKey<Type>(this, where, methodName);
    const normalize = getNormalize(options, methodName);

    if (value === null || value === undefined) {
      // `LOWER(col) = LOWER(NULL)` is never true either; don't bind a parameter for it
      return this[method]('FALSE');
    }

    const paramName = createUniqueParameterName(method);

    return this[method](`${normalize(column)} = ${normalize(`:${paramName}`)}`, {
      [paramName]: value,
    });
  };

const createWhereIsInLowerTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ReadonlyArray<string> | null | undefined,
    options?: TypedLowerOptions
  ): SelectQueryBuilder<Entity> {
    if (typeof where !== 'function') {
      return this;
    }

    const methodName = `${method}IsInLowerTyped`;
    const column = getTypedSingleColumnKey<Type>(this, where, methodName);
    const normalize = getNormalize(options, methodName);

    if (values !== null && values !== undefined && !Array.isArray(values)) {
      throw new TypeError(`${methodName} expects an array of values, got ${typeof values}`);
    }

    if (!values?.length) {
      // don't bind an empty list, same as whereIsIn
      return this[method]('FALSE');
    }

    // one parameter per value: each one is normalized by the database, like the column
    const paramName = createUniqueParameterName(method);
    const parameters: Record<string, string> = {};
    const placeholders = values.map((value, index) => {
      parameters[`${paramName}_${index}`] = value;

      return normalize(`:${paramName}_${index}`);
    });

    return this[method](`${normalize(column)} IN (${placeholders.join(', ')})`, parameters);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereLowerEqualsTyped: createWhereLowerEqualsTypedMethod('where'),
    andWhereLowerEqualsTyped: createWhereLowerEqualsTypedMethod('andWhere'),
    orWhereLowerEqualsTyped: createWhereLowerEqualsTypedMethod('orWhere'),
    whereIsInLowerTyped: createWhereIsInLowerTypedMethod('where'),
    andWhereIsInLowerTyped: createWhereIsInLowerTypedMethod('andWhere'),
    orWhereIsInLowerTyped: createWhereIsInLowerTypedMethod('orWhere'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

const lower = (sql: string): string => `LOWER(${sql})`;

/**
 * The wrapping for both sides: `options.normalize` or `LOWER(…)`. Its result must contain the
 * expression it was given, or the column / the parameter would be dropped from the condition.
 */
function getNormalize(
  options: TypedLowerOptions | undefined,
  methodName: string
): (sql: string) => string {
  const normalize = options?.normalize ?? lower;

  if (typeof normalize !== 'function') {
    throw new TypeError(`${methodName} expects options.normalize to be a function`);
  }

  return (sql: string): string => {
    const result = normalize(sql);

    if (typeof result !== 'string' || !result.includes(sql)) {
      throw new TypeError(
        `${methodName}: options.normalize must return an SQL expression containing its argument ` +
          `"${sql}", got ${JSON.stringify(result)}`
      );
    }

    return result;
  };
}
