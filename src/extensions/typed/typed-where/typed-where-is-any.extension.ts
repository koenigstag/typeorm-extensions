import '../../where-is-any.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { WhereAnyMethods } from '../../../types/extensions';
import { ArgsType } from '../../../types/util-types';

// declarations

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAnyTyped<Type extends ObjectLiteral>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new AND WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAnyTyped<Type extends ObjectLiteral>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new OR WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAnyTyped<Type extends ObjectLiteral>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new AND WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new OR WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new AND WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new OR WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new AND WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;

    /**
     * Adds new OR WHERE `column = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAnyTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      array?: ArgsType
    ): this;
  }
}

// patching

const createWhereIsAnyTypedMethod = (method: WhereAnyMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    array?: ArgsType
  ): SelectQueryBuilder<Entity> {
    return attachWhereIsAnyTyped<Type, SelectQueryBuilder<Entity>>(
      this,
      method,
      where,
      array
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsAnyTyped: createWhereIsAnyTypedMethod('whereIsAny'),
    andWhereIsAnyTyped: createWhereIsAnyTypedMethod('andWhereIsAny'),
    orWhereIsAnyTyped: createWhereIsAnyTypedMethod('orWhereIsAny'),
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

function attachWhereIsAnyTyped<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereAnyMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  array?: ArgsType
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedColumnKey<Type>(builder, where);

  if (Array.isArray(key)) {
    // one ANY condition per column has no single obvious meaning (AND? OR?), so don't guess
    throw new TypeError(
      `${method}Typed expects the callback to select a single column, got ${key.length}: ${key.join(', ')}`
    );
  }

  // .andWhere(`"table"."column" = ANY(:param)`, { param: ['value'] })
  return builder[method](key, array);
}
