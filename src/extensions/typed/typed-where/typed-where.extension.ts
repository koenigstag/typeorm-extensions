import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { ProxyColumnValueType } from '../../../types/modules/typeorm.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';

export interface TypedWhereOptions {
  useDoubleQuotes?: boolean;
}

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    whereTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    whereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity> {
    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    whereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity> {
    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    whereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): this;
  }
}

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
];

const extension = {
  prototype: {
    whereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'where',
        where,
        conditions,
        parameters,
        options
      );
    },
    andWhereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        where,
        conditions,
        parameters,
        options
      );
    },
    orWhereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        where,
        conditions,
        parameters,
        options
      );
    },
  },
};

queryBuilders.forEach((builder) => {
	Object.assign(builder, extension);
});

type WhereMethod = 'where' | 'andWhere' | 'orWhere';

function attachWhere<
  Type extends ObjectLiteral,
  Q extends WhereExpressionBuilder = WhereExpressionBuilder
>(
  builder: Q,
  method: WhereMethod,
  where: (proxy: Type) => ProxyColumnValueType,
  conditions: string,
  parameters?: ObjectLiteral,
  options?: TypedWhereOptions
): Q {
  if (typeof where === 'function') {
    const key = getSqlKeyFromProxyCallback<Type>(
      where,
      (builder as unknown as SelectQueryBuilder<Type>).alias,
      options?.useDoubleQuotes
    );

    // .andWhere(`"table"."column"   IN (:...values)`, { values: ['value'] })
    return builder[method](`${key} ${conditions}`, parameters);
  }

  return builder;
}
