import type { CursorOrderParam, RawCursorOrderParam } from '../interfaces/cursor-pagination.interface';
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

export type GetRawManyWithCursorOptions = {
  /**
   * SQL expressions that order the rows. On a query of an entity without GROUP BY or DISTINCT the
   * primary key of the main alias is appended when it isn't listed; otherwise the last key has to be
   * unique per row, or rows with equal keys may be skipped or repeated between pages.
   * It replaces any ORDER BY of the query.
   */
  orderBy: RawCursorOrderParam[];
};

export interface ListWithCursor<Entity> {
  /** The entities of the page, or with `getRawManyWithCursor` its raw rows. */
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
  /** The ORDER BY the page was read in: the `orderBy` keys, then the primary key columns not among them. */
  orderBy: OrderType[];
}
