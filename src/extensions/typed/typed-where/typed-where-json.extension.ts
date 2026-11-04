import '../../where-json.extension';
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
import type { WhereJsonMethods } from '../../where-json.extension';

// declarations

/**
 * Typesafe conditions on PostgreSQL `jsonb` / `json` columns: the column comes from an entity property.
 * See {@link WhereJsonMethods}.
 */
export interface TypedWhereJsonMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column @> :value` condition (PostgreSQL): the JSON document contains `value`.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereJsonContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new AND WHERE `column @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  andWhereJsonContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new OR WHERE `column @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  orWhereJsonContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Sets WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereJsonHasKeyTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    key: string
  ): this;

  /**
   * Adds new AND WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  andWhereJsonHasKeyTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    key: string
  ): this;

  /**
   * Adds new OR WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  orWhereJsonHasKeyTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    key: string
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereJsonMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereJsonMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereJsonMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereJsonMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereJsonTypedMethod = (method: keyof WhereJsonMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): SelectQueryBuilder<Entity> {
    return attachWhereJsonTyped<Type, SelectQueryBuilder<Entity>>(this, method, where, value);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereJsonContainsTyped: createWhereJsonTypedMethod('whereJsonContains'),
    andWhereJsonContainsTyped: createWhereJsonTypedMethod('andWhereJsonContains'),
    orWhereJsonContainsTyped: createWhereJsonTypedMethod('orWhereJsonContains'),
    whereJsonHasKeyTyped: createWhereJsonTypedMethod('whereJsonHasKey'),
    andWhereJsonHasKeyTyped: createWhereJsonTypedMethod('andWhereJsonHasKey'),
    orWhereJsonHasKeyTyped: createWhereJsonTypedMethod('orWhereJsonHasKey'),
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

function attachWhereJsonTyped<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: keyof WhereJsonMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  value: unknown
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`);

  // .andWhereJsonContains(`"table"."column"`, { role: 'admin' }) / .andWhereJsonHasKey(`"table"."column"`, 'role')
  // (one signature for both: `value` is the JSON value or the key, each method checks its own)
  return (builder[method] as (field: string, value: unknown) => QB)(key, value);
}
