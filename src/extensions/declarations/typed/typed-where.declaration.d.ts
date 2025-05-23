import type { ObjectLiteral } from "typeorm";
import type { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedWhereOptions } from "../../../types/extensions/typed-where.types";

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
