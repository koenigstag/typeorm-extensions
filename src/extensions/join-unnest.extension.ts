import { ObjectLiteral, QueryBuilder, SelectQueryBuilder } from 'typeorm';
import { ArgsType } from '../types/util-types';
import { patchPrototype } from '../utils/prototype.utils';
import { findFieldColumn, toFieldSql } from '../utils/query-builder.utils';
import { assertArrayType, createUniqueParameterName } from '../utils/sql.utils';

// declarations

export interface JoinUnnestMethods {
  /**
   * Keeps the rows whose `field` is one of `array`, joining the array as a set of rows:
   * `INNER JOIN (SELECT DISTINCT unnest(CAST(:array AS uuid[])) AS "value") "unnest_x7k2q"
   * ON "user"."id" = "unnest_x7k2q"."value"`. The same rows as `whereIsAny(field, array)`; for a
   * large array the planner can join from it instead of testing every row against it.
   *
   * `arrayType` (`'uuid[]'`) defaults to the array of the column type, when `field` names an entity
   * column; otherwise, and for enum columns, it is required. An empty array matches no row.
   * PostgreSQL and CockroachDB.
   */
  innerJoinUnnest(field: string, array: ArgsType | null | undefined, arrayType?: string): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends JoinUnnestMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    innerJoinUnnest<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array: ArgsType | null | undefined,
      arrayType?: string
    ): SelectQueryBuilder<Entity> {
      return innerJoinUnnest(this, field, array, arrayType);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

function innerJoinUnnest<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  field: string,
  array: ArgsType | null | undefined,
  arrayType?: string
): SelectQueryBuilder<Entity> {
  const castTo = assertArrayType(arrayType ?? columnArrayType(builder, field));

  if (!array?.length) {
    return builder.andWhere('FALSE');
  }

  const paramName = createUniqueParameterName('unnest');
  const alias = createUniqueParameterName('unnest');
  const value = builder.escape('value');

  // DISTINCT: a value repeated in the array would repeat the rows it matches
  return builder.innerJoin(
    `(SELECT DISTINCT unnest(CAST(:${paramName} AS ${castTo})) AS ${value})`,
    alias,
    `${toFieldSql(builder, field)} = ${builder.escape(alias)}.${value}`,
    { [paramName]: array }
  );
}

/** `<column type>[]` of the entity column `field` names, as the driver spells the type. */
function columnArrayType<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  field: string
): string {
  const column = findFieldColumn(builder, field);

  if (!column || column.type === 'enum' || column.type === 'simple-enum') {
    throw new TypeError(
      `innerJoinUnnest: pass the array type for "${field}", e.g. 'uuid[]': ` +
        (column ? 'the type of an enum column is named by the database' : 'it is not an entity column')
    );
  }

  const driver = (builder as unknown as QueryBuilder<ObjectLiteral>).connection.driver;

  return `${driver.normalizeType(column)}[]`;
}
