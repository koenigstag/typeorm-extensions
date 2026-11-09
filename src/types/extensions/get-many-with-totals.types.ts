import type { OrderType } from '../interfaces/ordering.interface';
import type { ApplyPaginationOptions } from './pagination.types';

/** Also takes the pagination options, e.g. `useTakeAndSkip` for queries with joined collections. */
export type GetManyWithTotalsOptions = ApplyPaginationOptions & {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};

export interface ListWithTotals<Entity> {
  list: Entity[];
  total: number | null;
  limit: number | null;
  offset: number | null;
  /** `null` when the total or the offset is unknown, e.g. with `loadAll` or `disableTotalsCalculation`. */
  hasMore: boolean | null;
  /** The ORDER BY clauses the query was built with, in the order they were applied. */
  orderBy: OrderType[];
}
