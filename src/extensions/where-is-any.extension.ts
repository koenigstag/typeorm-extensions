import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
} from 'typeorm';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import { toFieldSql } from '../utils/query-builder.utils';
import { ArgsType } from '../types/util-types';
import { WhereMethods } from '../types/extensions';
import {
  assertArrayType,
  createUniqueParameterName,
} from '../utils/sql.utils';

// declarations

export interface WhereIsAnyMethods {
  /**
   * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
   * The array is bound as a single parameter instead of one parameter per value.
   * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsAny(field: string, array?: ArgsType, arrayType?: string): this;

  /**
   * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
   */
  andWhereIsAny(field: string, array?: ArgsType, arrayType?: string): this;

  /**
   * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
   */
  orWhereIsAny(field: string, array?: ArgsType, arrayType?: string): this;

  /**
   * Sets WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL):
   * the field differs from every value of the array.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereIsNotAny(field: string, array?: ArgsType, arrayType?: string): this;

  /**
   * Adds new AND WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
   */
  andWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): this;

  /**
   * Adds new OR WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
   */
  orWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereIsAnyMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereIsAnyMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereIsAnyMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereIsAnyMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereIsAnyMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

type ArrayComparison = '= ANY' | '<> ALL';

const createWhereIsAnyMethod = (method: WhereMethods, comparison: ArrayComparison) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    array?: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachWhereIsAny<SelectQueryBuilder<Entity>>(
      this,
      method,
      field,
      comparison,
      array,
      arrayType
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsAny: createWhereIsAnyMethod('where', '= ANY'),
    andWhereIsAny: createWhereIsAnyMethod('andWhere', '= ANY'),
    orWhereIsAny: createWhereIsAnyMethod('orWhere', '= ANY'),
    whereIsNotAny: createWhereIsAnyMethod('where', '<> ALL'),
    andWhereIsNotAny: createWhereIsAnyMethod('andWhere', '<> ALL'),
    orWhereIsNotAny: createWhereIsAnyMethod('orWhere', '<> ALL'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

function attachWhereIsAny<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  comparison: ArrayComparison,
  array?: ArgsType,
  arrayType?: string
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  const castTo = arrayType === undefined ? undefined : assertArrayType(arrayType);

  if (!array?.length) {
    // don't bind an empty array, same as IN / NOT IN:
    // `= ANY('{}')` matches nothing, `<> ALL('{}')` matches everything
    return builder[method](comparison === '= ANY' ? 'FALSE' : 'TRUE');
  }

  const paramName = createUniqueParameterName(method);
  // CAST(... AS ...) rather than `::type`: TypeORM would read `::text` as a `:text` parameter
  const parameter = castTo ? `CAST(:${paramName} AS ${castTo})` : `:${paramName}`;

  // "table"."column" = ANY(:param) / <> ALL(:param), where :param is the whole array
  return builder[method](
    `${toFieldSql(builder, field)} ${comparison}(${parameter})`,
    { [paramName]: array }
  );
}
