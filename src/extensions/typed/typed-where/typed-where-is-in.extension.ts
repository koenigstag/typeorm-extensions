import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import '../../where-is-in.extension';
import { ProxyColumnValueType } from '../../../types/modules/typeorm.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';

export interface TypedWhereIsInOptions {
  useDoubleQuotes?: boolean;
}

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsInTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotInTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
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
    whereIsInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'whereIsIn',
        where,
        array,
        options
      );
    },
    andWhereIsInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'andWhereIsIn',
        where,
        array,
        options
      );
    },
    orWhereIsInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'orWhereIsIn',
        where,
        array,
        options
      );
    },
    whereIsNotInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'whereIsNotIn',
        where,
        array,
        options
      );
    },
    andWhereIsNotInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'andWhereIsNotIn',
        where,
        array,
        options
      );
    },
    orWhereIsNotInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: any[],
      options?: TypedWhereIsInOptions
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<Type, SelectQueryBuilder<Entity>>(
        this,
        'orWhereIsNotIn',
        where,
        array,
        options
      );
    },
  },
};

type ExtensionKeys = keyof typeof extension.prototype;

queryBuilders.forEach((builder) => {
	for (const method in Object.keys(extension.prototype)) {
    const methodName = method as ExtensionKeys;
    builder.prototype[methodName] = extension.prototype[methodName];
  }
});

type WhereMethods = 'whereIsIn' | 'andWhereIsIn' | 'orWhereIsIn' | 'whereIsNotIn' | 'andWhereIsNotIn' | 'orWhereIsNotIn';

function attachWhereIsIn<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  where: (proxy: Type) => ProxyColumnValueType,
  array?: any[],
  options?: TypedWhereIsInOptions
): QB {
  if (typeof where === 'function') {
    const key = getSqlKeyFromProxyCallback<Type>(
      where,
      (builder as unknown as SelectQueryBuilder<Type>).alias,
      options?.useDoubleQuotes
    );

    if (Array.isArray(key)) {
      throw new Error('Key must be a string, not an array');
    }

    // .andWhere(`"table"."column"   IN (:...values)`, { values: ['value'] })
    return builder[method](key, array);
  }

  return builder;
}
