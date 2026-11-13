import type { CursorOrderParam } from '../interfaces/cursor-pagination.interface';
import type { OrderType } from '../interfaces/ordering.interface';

export type GetManyWithCursorOptions<Entity> = {
  /**
   * Columns that order the rows, e.g. `[{ field: 'createdAt', direction: 'DESC' }]`.
   * The primary key is appended when it isn't listed, so the order is total and no row is skipped
   * or repeated between pages. It replaces any ORDER BY of the query.
   */
  orderBy: Array<CursorOrderParam<Entity>>;
  /** Use `take` instead of `limit`, as needed for queries with joined collections. Defaults to `false`. */
  useTakeAndSkip?: boolean;
};

export interface ListWithCursor<Entity> {
  list: Entity[];
  /** Cursor of the next page, `null` on the last page. */
  nextCursor: string | null;
  /**
   * Whether a next page follows. Always known, unlike the `hasMore` of `getManyWithTotals`: the
   * keyset query loads `pageSize + 1` rows, so it needs no total. Equivalent to `nextCursor !== null`.
   */
  hasMore: boolean;
  /** The page size used: the `pageSize` given, rounded down, or `10` when it was missing or below 1. */
  pageSize: number;
  /** The ORDER BY the page was read in: the `orderBy` columns, then the primary key columns not among them. */
  orderBy: OrderType[];
}
