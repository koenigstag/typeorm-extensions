import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { patchPrototype } from '../utils/prototype.utils';
import { toFieldSql } from '../utils/query-builder.utils';
import { ArgsType } from '../types/util-types';
import { WhereMethods } from '../types/extensions';
import {
  assertArrayType,
  createUniqueParameterName,
} from '../utils/sql.utils';

// declarations

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
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
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;

    /**
     * Sets WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL):
     * the field differs from every value of the array.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SelectQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;

    /**
     * Sets WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL):
     * the field differs from every value of the array.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): UpdateQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;

    /**
     * Sets WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL):
     * the field differs from every value of the array.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): DeleteQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * `arrayType` (e.g. `'uuid[]'`) casts the parameter: `= ANY(CAST(:array AS uuid[]))`.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;

    /**
     * Sets WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL):
     * the field differs from every value of the array.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field <> ALL(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsNotAny(field: string, array?: ArgsType, arrayType?: string): SoftDeleteQueryBuilder<Entity>;
  }
}

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

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SoftDeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});

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
