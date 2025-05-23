/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { randomString } from '../utils/common.utils';

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(
      field: string,
      array?: any[],
    ): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(
      field: string,
      array?: any[],
    ): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(
      field: string,
      array?: any[],
    ): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(
      field: string,
      array?: any[],
    ): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: any[],
    ): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: any[],
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
    whereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity>;
  }
}

// patching

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
];

const extension = {
  prototype: {
    whereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'where',
        field,
        'IN',
        array,
      );
    },
    andWhereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        field,
        'IN',
        array,
      );
    },
    orWhereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        field,
        'IN',
        array,
      );
    },
    whereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'where',
        field,
        'NOT IN',
        array,
      );
    },
    andWhereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[]
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        field,
        'NOT IN',
        array,
      );
    },
    orWhereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: any[],
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        field,
        'NOT IN',
        array,
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


// implementation

const createUniqueParameterName = (prefix?: string): string => {
  const uniqueCode = randomString(5);

  return `${prefix || 'param'}_${uniqueCode}`;
};

const prepareFieldName = (field: string): string =>
  field.includes('"')
    ? field
    : field
        .split('.')
        .map((f) => `"${f}"`)
        .join('.');

type WhereMethods = 'where' | 'andWhere' | 'orWhere';

function attachWhereIsIn<
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  field: string,
  operator: 'IN' | 'NOT IN',
  array?: any[]
): QB {
  if (method && typeof field === 'string' && typeof operator === 'string') {
    if (!array?.length) {
      return builder[method](`FALSE`);
    }

    field = prepareFieldName(field);
    const paramName = createUniqueParameterName('whereIn');

    // .andWhere(`"table"."column" IN (:...values)`, { values: ['value'] })
    return builder[method](`${field} ${operator} (:...${paramName})`, {
      [paramName]: array,
    });
  }

  return builder;
}
