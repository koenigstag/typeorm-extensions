import type { CursorOrderParam } from '../interfaces/cursor-pagination.interface';

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
}
