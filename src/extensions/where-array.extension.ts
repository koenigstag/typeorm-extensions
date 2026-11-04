import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { patchPrototype } from '../utils/prototype.utils';
import { toFieldSql } from '../utils/query-builder.utils';
import { ArgsType } from '../types/util-types';
import { WhereMethods } from '../types/extensions';
import {
  assertArrayType,
  createUniqueParameterName,
} from '../utils/sql.utils';

// declarations

/**
 * Conditions on PostgreSQL array columns (`text[]`, `int[]`, `uuid[]`, …).
 * The values are bound as one array parameter; `arrayType` (e.g. `'uuid[]'`) casts it:
 * `CAST(:values AS uuid[])`. The operators can use a GIN index on the column.
 */
export interface WhereArrayMethods {
  /**
   * Sets WHERE `field @> :values` condition (PostgreSQL): the array column contains every value.
   * An empty array matches every row with a non-null column.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContains(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new AND WHERE `field @> :values` condition (PostgreSQL): the array column contains every value.
   */
  andWhereArrayContains(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new OR WHERE `field @> :values` condition (PostgreSQL): the array column contains every value.
   */
  orWhereArrayContains(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Sets WHERE `field <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   * An empty column array always matches.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContainedBy(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new AND WHERE `field <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  andWhereArrayContainedBy(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new OR WHERE `field <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  orWhereArrayContainedBy(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Sets WHERE `field && :values` condition (PostgreSQL): the array column has at least one of the values.
   * An empty array matches nothing.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayOverlaps(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new AND WHERE `field && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  andWhereArrayOverlaps(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds new OR WHERE `field && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  orWhereArrayOverlaps(field: string, values: ArgsType, arrayType?: string): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereArrayMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereArrayMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereArrayMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereArrayMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

/** `@>` contains, `<@` is contained by, `&&` overlaps */
type ArrayOperator = '@>' | '<@' | '&&';

const createWhereArrayMethod = (method: WhereMethods, operator: ArrayOperator) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachWhereArray<SelectQueryBuilder<Entity>>(
      this,
      method,
      field,
      operator,
      values,
      arrayType
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereArrayContains: createWhereArrayMethod('where', '@>'),
    andWhereArrayContains: createWhereArrayMethod('andWhere', '@>'),
    orWhereArrayContains: createWhereArrayMethod('orWhere', '@>'),
    whereArrayContainedBy: createWhereArrayMethod('where', '<@'),
    andWhereArrayContainedBy: createWhereArrayMethod('andWhere', '<@'),
    orWhereArrayContainedBy: createWhereArrayMethod('orWhere', '<@'),
    whereArrayOverlaps: createWhereArrayMethod('where', '&&'),
    andWhereArrayOverlaps: createWhereArrayMethod('andWhere', '&&'),
    orWhereArrayOverlaps: createWhereArrayMethod('orWhere', '&&'),
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

function attachWhereArray<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  operator: ArrayOperator,
  values: ArgsType,
  arrayType?: string
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  if (!Array.isArray(values)) {
    // a missing array has no safe meaning here: `@> '{}'` would match every row
    throw new TypeError(`Array condition on "${field}" expects an array of values, got ${values}`);
  }

  const castTo = arrayType === undefined ? undefined : assertArrayType(arrayType);
  const paramName = createUniqueParameterName(method);
  // CAST(... AS ...) rather than `::type`: TypeORM would read `::text` as a `:text` parameter
  const parameter = castTo ? `CAST(:${paramName} AS ${castTo})` : `:${paramName}`;

  // the array is bound as is, empty arrays included: PostgreSQL's own semantics apply
  // ("table"."tags" @> :param, where :param is the whole array)
  return builder[method](
    `${toFieldSql(builder, field)} ${operator} ${parameter}`,
    { [paramName]: values }
  );
}
