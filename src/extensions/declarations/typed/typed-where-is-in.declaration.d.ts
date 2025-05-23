import type { ObjectLiteral } from 'typeorm';
import type { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type { ArgsType } from '../../../types/util-types';
import type { TypedWhereIsInOptions } from '../../../types/extensions/typed-where.types';

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
      options?: TypedWhereIsInOptions
    ): this;
  }
}
