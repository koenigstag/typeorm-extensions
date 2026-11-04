import '../../where-is-distinct-from.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import type { WhereDistinctMethods } from '../../where-is-distinct-from.extension';

// declarations

/**
 * Typesafe null-safe comparisons: the column comes from an entity property.
 * See {@link WhereDistinctMethods}.
 */
export interface TypedWhereDistinctMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column IS DISTINCT FROM :value` condition: the column differs from the value, `NULL` included.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new AND WHERE `column IS DISTINCT FROM :value` condition: the column differs from the value, `NULL` included.
   */
  andWhereIsDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new OR WHERE `column IS DISTINCT FROM :value` condition: the column differs from the value, `NULL` included.
   */
  orWhereIsDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Sets WHERE `column IS NOT DISTINCT FROM :value` condition: the column equals the value, `NULL` included.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new AND WHERE `column IS NOT DISTINCT FROM :value` condition: the column equals the value, `NULL` included.
   */
  andWhereIsNotDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new OR WHERE `column IS NOT DISTINCT FROM :value` condition: the column equals the value, `NULL` included.
   */
  orWhereIsNotDistinctFromTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereDistinctMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereDistinctMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereDistinctMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereDistinctMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereDistinctTypedMethod = (method: keyof WhereDistinctMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): SelectQueryBuilder<Entity> {
    return attachWhereDistinctTyped<Type, SelectQueryBuilder<Entity>>(this, method, where, value);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsDistinctFromTyped: createWhereDistinctTypedMethod('whereIsDistinctFrom'),
    andWhereIsDistinctFromTyped: createWhereDistinctTypedMethod('andWhereIsDistinctFrom'),
    orWhereIsDistinctFromTyped: createWhereDistinctTypedMethod('orWhereIsDistinctFrom'),
    whereIsNotDistinctFromTyped: createWhereDistinctTypedMethod('whereIsNotDistinctFrom'),
    andWhereIsNotDistinctFromTyped: createWhereDistinctTypedMethod('andWhereIsNotDistinctFrom'),
    orWhereIsNotDistinctFromTyped: createWhereDistinctTypedMethod('orWhereIsNotDistinctFrom'),
  },
};

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});

// implementation

function attachWhereDistinctTyped<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: keyof WhereDistinctMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  value: unknown
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`);

  // .andWhereIsDistinctFrom(`"table"."column"`, value)
  return builder[method](key, value);
}
