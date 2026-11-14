import '../../where-json.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { attachTypedColumnWhere } from '../../../utils/typed-where.utils';
import type { WhereJsonMethods } from '../../where-json.extension';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

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
  whereJsonContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new AND WHERE `column @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  andWhereJsonContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Adds new OR WHERE `column @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  orWhereJsonContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): this;

  /**
   * Sets WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereJsonHasKeyTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    key: string
  ): this;

  /**
   * Adds new AND WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  andWhereJsonHasKeyTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    key: string
  ): this;

  /**
   * Adds new OR WHERE `column ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  orWhereJsonHasKeyTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
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

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereJsonMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereJsonTypedMethod = (method: keyof WhereJsonMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    value: unknown
  ): SelectQueryBuilder<Entity> {
    // one signature for both: `value` is the JSON value or the key, each method checks its own
    return attachTypedColumnWhere<Type, SelectQueryBuilder<Entity>>(this, method, where, { accessor: 'json' }, value);
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

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

