import '../../where-is-any.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedArrayArg, TypeOrDefault, UnsetType } from '../../../types/modules/typed-params.types';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { attachTypedColumnWhere } from '../../../utils/typed-where.utils';
import { WhereAnyMethods } from '../../../types/extensions';
import { ArgsType } from '../../../types/util-types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

export interface TypedWhereIsAnyMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
   * The array is bound as a single parameter instead of one parameter per value.
   * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
   */
  andWhereIsAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
   */
  orWhereIsAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;

  /**
   * Sets WHERE `column <> ALL(:array)` condition in the query builder (PostgreSQL):
   * the column differs from every value of the array.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column <> ALL(:array)` condition in the query builder (PostgreSQL).
   */
  andWhereIsNotAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column <> ALL(:array)` condition in the query builder (PostgreSQL).
   */
  orWhereIsNotAnyTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    array?: TypedArrayArg<Type, Value>,
    arrayType?: string
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereIsAnyMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsAnyMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsAnyMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsAnyMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsAnyMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereIsAnyTypedMethod = (method: WhereAnyMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    array?: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachTypedColumnWhere<Type, SelectQueryBuilder<Entity>>(
      this,
      method,
      where,
      { value: array },
      array,
      arrayType
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsAnyTyped: createWhereIsAnyTypedMethod('whereIsAny'),
    andWhereIsAnyTyped: createWhereIsAnyTypedMethod('andWhereIsAny'),
    orWhereIsAnyTyped: createWhereIsAnyTypedMethod('orWhereIsAny'),
    whereIsNotAnyTyped: createWhereIsAnyTypedMethod('whereIsNotAny'),
    andWhereIsNotAnyTyped: createWhereIsAnyTypedMethod('andWhereIsNotAny'),
    orWhereIsNotAnyTyped: createWhereIsAnyTypedMethod('orWhereIsNotAny'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

