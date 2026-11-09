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
  /**
   * Whether rows follow the page. `null` only with `loadAll`, where the page is every row.
   * With `disableTotalsCalculation` it is still known: one row past the page is loaded and dropped,
   * instead of counting.
   */
  hasMore: boolean | null;
  /** The ORDER BY clauses the query was built with, in the order they were applied. */
  orderBy: OrderType[];
}
