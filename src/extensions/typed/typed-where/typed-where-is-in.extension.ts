import '../../where-is-in.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedArrayArg, TypeOrDefault, UnsetType } from '../../../types/modules/typed-params.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { WhereInMethods } from '../../../types/extensions';
import { ArgsType } from '../../../types/util-types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

export interface TypedWhereIsInMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE IN condition in the query builder.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;

  /**
   * Adds new AND WHERE IN condition in the query builder.
   */
  andWhereIsInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;

  /**
   * Adds new OR WHERE IN condition in the query builder.
   */
  orWhereIsInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;

  /**
   * Sets WHERE NOT IN condition in the query builder.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;

  /**
   * Adds new AND WHERE NOT IN condition in the query builder.
   */
  andWhereIsNotInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;

  /**
   * Adds new OR WHERE NOT IN condition in the query builder.
   */
  orWhereIsNotInTyped<Type extends ObjectLiteral = UnsetType, Value extends ProxyColumnValueType = ProxyColumnValueType>(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value,
    array?: TypedArrayArg<Type, Value>
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereIsInMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsInMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsInMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsInMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereIsInMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereIsInTypedMethod = (method: WhereInMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    array?: ArgsType
  ): SelectQueryBuilder<Entity> {
    return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(this, method, where, array);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsInTyped: createWhereIsInTypedMethod('whereIsIn'),
    andWhereIsInTyped: createWhereIsInTypedMethod('andWhereIsIn'),
    orWhereIsInTyped: createWhereIsInTypedMethod('orWhereIsIn'),
    whereIsNotInTyped: createWhereIsInTypedMethod('whereIsNotIn'),
    andWhereIsNotInTyped: createWhereIsInTypedMethod('andWhereIsNotIn'),
    orWhereIsNotInTyped: createWhereIsInTypedMethod('orWhereIsNotIn'),
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

// implementation

function attachWhereIsIn<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereInMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  array?: ArgsType
): QB {
  if (typeof where === 'function') {
    // several columns have no single meaning (AND? OR?), and `where…` kept only the last one
    const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`, { value: array });

    // .andWhere(`"table"."column"   IN (:...values)`, { values: ['value'] })
    return builder[method](key, array);
  }

  return builder;
}
