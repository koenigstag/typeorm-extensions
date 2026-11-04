import '../../where-array.extension';
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
import { ArgsType } from '../../../types/util-types';
import type { WhereArrayMethods } from '../../where-array.extension';

// declarations

/**
 * Typesafe conditions on PostgreSQL array columns: the column comes from an entity property.
 * See {@link WhereArrayMethods}.
 */
export interface TypedWhereArrayMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   */
  andWhereArrayContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   */
  orWhereArrayContainsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Sets WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContainedByTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  andWhereArrayContainedByTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  orWhereArrayContainedByTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Sets WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayOverlapsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  andWhereArrayOverlapsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  orWhereArrayOverlapsTyped<Type extends ObjectLiteral = Entity>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereArrayMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereArrayTypedMethod = (method: keyof WhereArrayMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachWhereArrayTyped<Type, SelectQueryBuilder<Entity>>(
      this,
      method,
      where,
      values,
      arrayType
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereArrayContainsTyped: createWhereArrayTypedMethod('whereArrayContains'),
    andWhereArrayContainsTyped: createWhereArrayTypedMethod('andWhereArrayContains'),
    orWhereArrayContainsTyped: createWhereArrayTypedMethod('orWhereArrayContains'),
    whereArrayContainedByTyped: createWhereArrayTypedMethod('whereArrayContainedBy'),
    andWhereArrayContainedByTyped: createWhereArrayTypedMethod('andWhereArrayContainedBy'),
    orWhereArrayContainedByTyped: createWhereArrayTypedMethod('orWhereArrayContainedBy'),
    whereArrayOverlapsTyped: createWhereArrayTypedMethod('whereArrayOverlaps'),
    andWhereArrayOverlapsTyped: createWhereArrayTypedMethod('andWhereArrayOverlaps'),
    orWhereArrayOverlapsTyped: createWhereArrayTypedMethod('orWhereArrayOverlaps'),
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

function attachWhereArrayTyped<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: keyof WhereArrayMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  values: ArgsType,
  arrayType?: string
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`);

  // .andWhereArrayContains(`"table"."column"`, ['value'])
  return builder[method](key, values, arrayType);
}
