import type { OrderDirection } from '../types/interfaces/ordering.interface';
import { defaultOrderDirection } from '../constants';

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
