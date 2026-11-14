import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { NullsOrder, OrderDirection } from '../types/interfaces/ordering.interface';
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
 * `'NULLS FIRST'` / `'NULLS LAST'` for `first` / `last` or the SQL form itself, in any case and with
 * spaces around: TypeORM takes only the exact SQL form. `undefined` for anything else.
 */
export function toSqlNullsOrder(nulls: NullsOrder | undefined | null): 'NULLS FIRST' | 'NULLS LAST' | undefined {
  if (typeof nulls !== 'string') {
    return undefined;
  }

  const value = nulls.trim().toLowerCase();
  const order = value.startsWith('nulls') ? value.slice('nulls'.length).trim() : value;

  return order === 'first' || order === 'last' ? (`NULLS ${order.toUpperCase()}` as 'NULLS FIRST' | 'NULLS LAST') : undefined;
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
