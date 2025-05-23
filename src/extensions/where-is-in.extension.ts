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
  interface SelectQueryBuilder<Entity> {
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

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity> {
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

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity> {
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

function whereIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this.where(`FALSE`);
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('whereIn');

  return this.where(`${field} IN (:...${paramName})`, { [paramName]: array });
}

function whereNotIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this;
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('whereNotIn');

  return this.where(`${field} NOT IN (:...${paramName})`, {
    [paramName]: array,
  });
}

function andWhereIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this.andWhere(`FALSE`);
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('andWhereIn');

  return this.andWhere(`${field} IN (:...${paramName})`, {
    [paramName]: array,
  });
}

function andWhereNotIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this;
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('andWhereNotIn');

  return this.andWhere(`${field} NOT IN (:...${paramName})`, {
    [paramName]: array,
  });
}

function orWhereIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this.orWhere(`FALSE`);
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('orWhereIn');

  return this.orWhere(`${field} IN (:...${paramName})`, { [paramName]: array });
}

function orWhereNotIn<QB extends WhereExpressionBuilder>(
  this: QB,
  field: string,
  array?: Array<any>
): QB {
  if (!array?.length) {
    return this;
  }

  field = prepareFieldName(field);
  const paramName = createUniqueParameterName('orWhereNotIn');

  return this.orWhere(`${field} NOT IN (:...${paramName})`, {
    [paramName]: array,
  });
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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
      return attachWhereIsIn<Entity, SelectQueryBuilder<Entity>>(
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

type WhereMethods = 'where' | 'andWhere' | 'orWhere';

function attachWhereIsIn<
  Entity extends ObjectLiteral,
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
