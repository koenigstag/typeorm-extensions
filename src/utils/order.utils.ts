import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { OrderDirection } from '../types/interfaces/ordering.interface';
import type { ArgsType } from '../types/util-types';
import { defaultOrderDirection } from '../constants';
import { assertArrayType, createUniqueParameterName } from './sql.utils';

/**
 * `'ASC'` / `'DESC'` for any `OrderDirection`: `'asc'` / `'desc'` in any case, `1` / `-1`,
 * `true` (ASC) / `false` (DESC). Anything else is the default direction (ASC).
 */
export function toSqlOrderDirection(direction: OrderDirection | undefined | null): 'ASC' | 'DESC' {
  if (typeof direction === 'boolean') {
    return direction ? 'ASC' : 'DESC';
  }

  if (typeof direction === 'number') {
    return direction === -1 ? 'DESC' : 'ASC';
  }

  if (typeof direction === 'string' && /asc|desc/i.test(direction)) {
    return direction.toUpperCase() as 'ASC' | 'DESC';
  }

  return defaultOrderDirection;
}

/**
 * Selects `array_position(:values, column)` under a generated alias and orders by that alias.
 * TypeORM can't order by a function expression together with `take` and joins
 * (`"array_position(…" alias was not found`), but it can order by a selection alias.
 * `column` is already quoted.
 */
export function attachOrderByArrayPosition<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  column: string,
  values: ArgsType,
  arrayType: string | undefined,
  replace: boolean
): SelectQueryBuilder<Entity> {
  if (!Array.isArray(values)) {
    throw new TypeError(`orderByArrayPosition on "${column}" expects an array of values, got ${values}`);
  }

  const castTo = arrayType === undefined ? undefined : assertArrayType(arrayType);
  const paramName = createUniqueParameterName('position');
  // lower case: PostgreSQL folds the unquoted alias in ORDER BY
  const selectionAlias = `array_${paramName}`.toLowerCase();
  const parameter = castTo ? `CAST(:${paramName} AS ${castTo})` : `:${paramName}`;

  builder
    .addSelect(`array_position(${parameter}, ${column})`, selectionAlias)
    .setParameter(paramName, values);

  return replace
    ? builder.orderBy(selectionAlias, 'ASC', 'NULLS LAST')
    : builder.addOrderBy(selectionAlias, 'ASC', 'NULLS LAST');
}
