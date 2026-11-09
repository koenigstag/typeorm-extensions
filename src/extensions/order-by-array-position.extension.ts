import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { patchPrototype } from '../utils/prototype.utils';
import type { ArgsType } from '../types/util-types';
import { toFieldSql } from '../utils/query-builder.utils';
import { attachOrderByArrayPosition } from '../utils/order.utils';

// declarations

export interface OrderByArrayPositionMethods {
  /**
   * Sets ORDER BY the position of the column's value in `values` (PostgreSQL):
   * `array_position(:values, column)`. Keeps the order of ids that come from elsewhere
   * (search results, recommendations), e.g. after `whereIsAny(column, ids)`.
   * Rows whose value isn't in `values` come last. `arrayType` (e.g. `'uuid[]'`) casts the array.
   * Like `orderBy`, it replaces the previous ORDER BY.
   *
   * The position is selected under a generated alias (`array_position_…`) and ordered by it,
   * which also works with `take` / `skip` and joins; it shows up in `getRawMany()` results.
   */
  orderByArrayPosition(field: string, values: ArgsType, arrayType?: string): this;

  /**
   * Adds ORDER BY the position of the column's value in `values` (PostgreSQL), like `addOrderBy`.
   * See `orderByArrayPosition`.
   */
  addOrderByArrayPosition(field: string, values: ArgsType, arrayType?: string): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends OrderByArrayPositionMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const createOrderByArrayPositionMethod = (replace: boolean) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachOrderByArrayPosition(this, toFieldSql(this, field), values, arrayType, replace);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    orderByArrayPosition: createOrderByArrayPositionMethod(true),
    addOrderByArrayPosition: createOrderByArrayPositionMethod(false),
  },
};

patchPrototype(SelectQueryBuilder, extension);
