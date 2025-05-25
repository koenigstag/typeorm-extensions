import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { WhereMethods } from '../../../types/extensions';
import { TypedWhereOptions } from '../../../types/extensions/typed-where.types';
import { attachWhere } from '../../../utils/where.utils';

// declarations

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
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral>(
      subQuery: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
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
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
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
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
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
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): this;

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhereTyped<Type extends ObjectLiteral = Entity>(
      where: (proxy: Type) => ProxyColumnValueType,
      conditions: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): this;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      operator: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'where',
        where,
        operator,
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
      operator: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        where,
        operator,
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
      operator: string,
      parameters?: any,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        where,
        operator,
        parameters,
        options
      );
    },
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

function attachTypedWhere<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder = WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  where: (proxy: Type) => ProxyColumnValueType,
  conditions: string,
  parameters?: unknown,
  options?: TypedWhereOptions
): QB {
  const { useDoubleQuotes, addValue = true } = options || {};

  if (typeof where === 'function') {
    const alias = (builder as unknown as SelectQueryBuilder<Type>).alias;
    const key = getSqlKeyFromProxyCallback<Type>(where, alias, useDoubleQuotes);

    if (Array.isArray(key)) {
      for (const k of key) {
        builder = attachWhere<QB>(builder, method, k, conditions, parameters, {
          addValue,
        });
      }

      return builder;
    }

    return attachWhere<QB>(builder, method, key, conditions, parameters, {
      addValue,
    });
  }

  return builder;
}
