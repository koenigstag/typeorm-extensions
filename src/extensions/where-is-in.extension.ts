import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
} from 'typeorm';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import { ArgsType } from '../types/util-types';
import { WhereMethods } from '../types/extensions';
import { attachWhere } from '../utils/where.utils';

// declarations

export interface WhereIsInMethods {
  /**
   * Sets WHERE IN condition in the query builder.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsIn(field: string, array?: ArgsType): this;

  /**
   * Adds new AND WHERE IN condition in the query builder.
   */
  andWhereIsIn(field: string, array?: ArgsType): this;

  /**
   * Adds new OR WHERE IN condition in the query builder.
   */
  orWhereIsIn(field: string, array?: ArgsType): this;

  /**
   * Sets WHERE NOT IN condition in the query builder.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotIn(field: string, array?: ArgsType): this;

  /**
   * Adds new AND WHERE NOT IN condition in the query builder.
   */
  andWhereIsNotIn(field: string, array?: ArgsType): this;

  /**
   * Adds new OR WHERE NOT IN condition in the query builder.
   */
  orWhereIsNotIn(field: string, array?: ArgsType): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereIsInMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereIsInMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereIsInMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereIsInMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereIsInMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const createWhereIsInMethod = (method: WhereMethods, operator: 'IN' | 'NOT IN') =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    array?: ArgsType
  ): SelectQueryBuilder<Entity> {
    return attachWhereIsIn<SelectQueryBuilder<Entity>>(this, method, field, operator, array);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsIn: createWhereIsInMethod('where', 'IN'),
    andWhereIsIn: createWhereIsInMethod('andWhere', 'IN'),
    orWhereIsIn: createWhereIsInMethod('orWhere', 'IN'),
    whereIsNotIn: createWhereIsInMethod('where', 'NOT IN'),
    andWhereIsNotIn: createWhereIsInMethod('andWhere', 'NOT IN'),
    orWhereIsNotIn: createWhereIsInMethod('orWhere', 'NOT IN'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

function attachWhereIsIn<
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  field: string,
  operator: 'IN' | 'NOT IN',
  array?: ArgsType
): QB {
  if (method && typeof field === 'string' && typeof operator === 'string') {
    if (!array?.length) {
      // if the array is empty, we can use a simple condition
      // IN (empty array) => FALSE
      // NOT IN (empty array) => TRUE
      return builder[method](operator === 'IN' ? 'FALSE' : 'TRUE');
    }

    return attachWhere(
      builder,
      method,
      field,
      operator,
      { value: array },
      {
        addValue: true,
      }
    );
  }

  return builder;
}
