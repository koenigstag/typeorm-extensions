import '../../where-is-in.extension';
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
import { WhereInMethods } from '../../../types/extensions';
import { ArgsType } from '../../../types/util-types';
import { TypedWhereIsInOptions } from '../../../types/extensions/typed-where.types';

// declarations

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

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsInTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      array?: ArgsType,
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
      array?: ArgsType,
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
      array?: ArgsType,
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
      array?: ArgsType,
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
      array?: ArgsType,
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
      array?: ArgsType,
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

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
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
  where: (proxy: Type) => ProxyColumnValueType,
  array?: ArgsType,
  options?: TypedWhereIsInOptions
): QB {
  const { useDoubleQuotes } = options || {};

  if (typeof where === 'function') {
    const alias = (builder as unknown as SelectQueryBuilder<Type>).alias;
    const key = getSqlKeyFromProxyCallback<Type>(
      where,
      alias,
      useDoubleQuotes
    );

    if (Array.isArray(key)) {
      for (const k of key) {
        builder = builder[method](k, array);
      }

      return builder;
    }

    // .andWhere(`"table"."column"   IN (:...values)`, { values: ['value'] })
    return builder[method](key, array);
  }

  return builder;
}
