import type { OrderType } from '../interfaces/ordering.interface';
import type { ApplyPaginationOptions } from './pagination.types';

/** Also takes the pagination options, e.g. `useTakeAndSkip` for queries with joined collections. */
export type GetManyWithTotalsOptions = ApplyPaginationOptions & {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};

/** Options of `getRawManyWithTotals`. Raw rows are paged with LIMIT / OFFSET, so there is no `useTakeAndSkip`. */
export type GetRawManyWithTotalsOptions = Omit<GetManyWithTotalsOptions, 'useTakeAndSkip'> & {
  /**
   * An expression that counts the rows of the query by itself, such as `COUNT(DISTINCT "order"."user_id")`
   * for a query grouped by `"order"."user_id"`: cheaper than counting the query as a subquery.
   * It replaces the select list, and GROUP BY, HAVING and DISTINCT are dropped: it can't count a query with HAVING,
   * and counts a DISTINCT query only when it is a `COUNT(DISTINCT …)` itself.
   */
  countExpression?: string;
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
