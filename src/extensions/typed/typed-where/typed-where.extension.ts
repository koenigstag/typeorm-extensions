import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedWhereArgs, TypeOrDefault, UnsetType } from '../../../types/modules/typed-params.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { WhereMethods } from '../../../types/extensions';
import { TypedWhereOptions } from '../../../types/extensions/typed-where.types';
import { attachWhere, isParamsObject } from '../../../utils/where.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Typesafe WHERE conditions: the column comes from an entity property.
 * `Type` defaults to the query builder's entity; with the `strictParams` option (see `TypeormExtensionsConfig`)
 * the parameter is checked against the type of the selected column.
 */
export interface TypedWhereMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE condition in the query builder.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   * Additionally you can add parameters used in where expression.
   */
  whereTyped<
    Type extends ObjectLiteral = UnsetType,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, Value>
  ): this;

  /**
   * Adds new AND WHERE condition in the query builder.
   * Additionally you can add parameters used in where expression.
   */
  andWhereTyped<
    Type extends ObjectLiteral = UnsetType,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, Value>
  ): this;

  /**
   * Adds new OR WHERE condition in the query builder.
   * Additionally you can add parameters used in where expression.
   */
  orWhereTyped<
    Type extends ObjectLiteral = UnsetType,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, Value>
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereTypedMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    conditions: string,
    parameters?: unknown,
    options?: TypedWhereOptions
  ): SelectQueryBuilder<Entity> {
    return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
      this,
      method,
      where,
      conditions,
      parameters,
      options
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereTyped: createWhereTypedMethod('where'),
    andWhereTyped: createWhereTypedMethod('andWhere'),
    orWhereTyped: createWhereTypedMethod('orWhere'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

function attachTypedWhere<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder = WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  conditions: string,
  parameters?: unknown,
  options?: TypedWhereOptions
): QB {
  const { addValue } = options || {};

  if (typeof where === 'function') {
    // several columns have no single meaning (AND? OR?), and `where…` kept only the last one
    // a path into a JSON column is cast to the type of the value it is compared with
    const value = isParamsObject(parameters) ? Object.values(parameters)[0] : parameters;
    const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`, { value });

    return attachWhere<QB>(builder, method, key, conditions, parameters, {
      addValue,
    });
  }

  return builder;
}
