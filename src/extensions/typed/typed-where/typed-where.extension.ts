import {
  FindOperator,
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedWhereCondition, TypedWhereConditionArgs, TypeOrDefault, UnsetType } from '../../../types/modules/typed-params.types';
import { getTypedConditionKey, isTypedJsonPath, toFieldSql } from '../../../utils/query-builder.utils';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../../../utils/prototype.utils';
import { WhereMethods } from '../../../types/extensions';
import { TypedWhereOptions } from '../../../types/extensions/typed-where.types';
import { addCondition, attachWhere, getComparedValue, isParamsObject } from '../../../utils/where.utils';
import { getFindOperatorValue, isFindOperator, renderFindOperator } from '../../../utils/find-operator.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Typesafe WHERE conditions: the column comes from an entity property.
 * `Type` defaults to the query builder's entity; with the `strictParams` option (see `TypeormExtensionsConfig`)
 * the parameter is checked against the type of the selected column.
 *
 * The condition is SQL (`'IS NULL'`, `'>='` with a value) or a TypeORM find operator (`IsNull()`, `Not(IsNull())`,
 * `MoreThanOrEqual(date)`, `In([…])`, `EqualColumn(…)`), written as `find({ where })` writes it. An operator's value
 * is always checked against the column's type, except when `Type` is given: TypeScript then can't infer the column.
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
    Condition extends TypedWhereCondition<Value> = TypedWhereCondition<Value>,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Condition,
    ...args: TypedWhereConditionArgs<Type, Condition, Value>
  ): this;

  /**
   * Adds new AND WHERE condition in the query builder.
   * Additionally you can add parameters used in where expression.
   */
  andWhereTyped<
    Type extends ObjectLiteral = UnsetType,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Condition extends TypedWhereCondition<Value> = TypedWhereCondition<Value>,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Condition,
    ...args: TypedWhereConditionArgs<Type, Condition, Value>
  ): this;

  /**
   * Adds new OR WHERE condition in the query builder.
   * Additionally you can add parameters used in where expression.
   */
  orWhereTyped<
    Type extends ObjectLiteral = UnsetType,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Condition extends TypedWhereCondition<Value> = TypedWhereCondition<Value>,
  >(
    where: (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity, this>>>) => Value,
    conditions: Condition,
    ...args: TypedWhereConditionArgs<Type, Condition, Value>
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
    conditions: string | FindOperator<unknown>,
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
  conditions: string | FindOperator<unknown>,
  parameters?: unknown,
  options?: TypedWhereOptions
): QB {
  const { addValue } = options || {};

  if (typeof where === 'function' && isFindOperator(conditions)) {
    const value = getFindOperatorValue(conditions);
    const key = getTypedConditionKey<Type>(builder, where, `${method}Typed`, { value });

    return addCondition(builder, method)(renderFindOperator(builder, toFieldSql(builder, key), conditions));
  }

  if (typeof where === 'function' && typeof conditions === 'string') {
    // a JSON path compared by order with numeric text is compared as a number: as text '9' >= '10'
    const params =
      isOrderingCondition(conditions) && isTypedJsonPath<Type>(builder, where)
        ? withNumericTextAsNumber(parameters)
        : parameters;
    // several columns have no single meaning (AND? OR?), and `where…` kept only the last one
    // a path into a JSON column is cast to the type of the value it is compared with
    const value = getComparedValue(params);
    const key = getTypedConditionKey<Type>(builder, where, `${method}Typed`, { value });

    return attachWhere<QB>(builder, method, key, conditions, params, {
      addValue,
    });
  }

  return builder;
}

// `>=`, or `>= :min` with the value in a params object
const ORDERING_CONDITION = /^\s*(?:<=|>=|<|>)\s*(?::\w+\s*)?$/;
const NUMERIC_TEXT = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i;

const isOrderingCondition = (conditions: string): boolean =>
  typeof conditions === 'string' && ORDERING_CONDITION.test(conditions);

const toNumberIfNumericText = (value: unknown): unknown =>
  typeof value === 'string' && NUMERIC_TEXT.test(value) ? Number(value) : value;

function withNumericTextAsNumber(parameters: unknown): unknown {
  if (!isParamsObject(parameters)) {
    return toNumberIfNumericText(parameters);
  }

  const entries = Object.entries(parameters);

  return entries.length === 1 ? { [entries[0][0]]: toNumberIfNumericText(entries[0][1]) } : parameters;
}
