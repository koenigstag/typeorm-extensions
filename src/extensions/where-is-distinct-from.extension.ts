import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
} from 'typeorm';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import { toFieldSql } from '../utils/query-builder.utils';
import { WhereMethods } from '../types/extensions';
import {
  buildDistinctCondition,
  createUniqueParameterName,
  getDriverType,
} from '../utils/sql.utils';

// declarations

/**
 * Null-safe comparisons: `NULL` is a value like any other, so `NULL` equals `NULL`
 * and differs from `1`, where `=` / `<>` would give `NULL` and drop the row.
 * `null` / `undefined` compare with `NULL`.
 *
 * PostgreSQL and most databases: `IS [NOT] DISTINCT FROM`; MySQL / MariaDB: `<=>`; SQLite: `IS [NOT]`.
 */
export interface WhereDistinctMethods {
  /**
   * Sets WHERE `field IS DISTINCT FROM :value` condition: the field differs from the value,
   * `NULL` included (`NULL` differs from `1`, but not from `NULL`).
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsDistinctFrom(field: string, value: unknown): this;

  /**
   * Adds new AND WHERE `field IS DISTINCT FROM :value` condition: the field differs from the value, `NULL` included.
   */
  andWhereIsDistinctFrom(field: string, value: unknown): this;

  /**
   * Adds new OR WHERE `field IS DISTINCT FROM :value` condition: the field differs from the value, `NULL` included.
   */
  orWhereIsDistinctFrom(field: string, value: unknown): this;

  /**
   * Sets WHERE `field IS NOT DISTINCT FROM :value` condition: the field equals the value,
   * `NULL` included (`NULL` equals `NULL`).
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotDistinctFrom(field: string, value: unknown): this;

  /**
   * Adds new AND WHERE `field IS NOT DISTINCT FROM :value` condition: the field equals the value, `NULL` included.
   */
  andWhereIsNotDistinctFrom(field: string, value: unknown): this;

  /**
   * Adds new OR WHERE `field IS NOT DISTINCT FROM :value` condition: the field equals the value, `NULL` included.
   */
  orWhereIsNotDistinctFrom(field: string, value: unknown): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereDistinctMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereDistinctMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereDistinctMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereDistinctMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereDistinctMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const createWhereDistinctMethod = (method: WhereMethods, distinct: boolean) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    value: unknown
  ): SelectQueryBuilder<Entity> {
    return attachWhereDistinct<SelectQueryBuilder<Entity>>(this, method, field, distinct, value);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsDistinctFrom: createWhereDistinctMethod('where', true),
    andWhereIsDistinctFrom: createWhereDistinctMethod('andWhere', true),
    orWhereIsDistinctFrom: createWhereDistinctMethod('orWhere', true),
    whereIsNotDistinctFrom: createWhereDistinctMethod('where', false),
    andWhereIsNotDistinctFrom: createWhereDistinctMethod('andWhere', false),
    orWhereIsNotDistinctFrom: createWhereDistinctMethod('orWhere', false),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation


function attachWhereDistinct<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  distinct: boolean,
  value: unknown
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  const driver = getDriverType(builder);
  const column = toFieldSql(builder, field);

  if (value === null || value === undefined) {
    // compare with the NULL literal, no parameter to bind
    return builder[method](buildDistinctCondition(driver, column, distinct, 'NULL'));
  }

  const paramName = createUniqueParameterName(method);

  return builder[method](
    buildDistinctCondition(driver, column, distinct, `:${paramName}`),
    { [paramName]: value }
  );
}
