import type { NonFunctionPropertyNames } from '../util-types';
import type { OrderDirection } from './ordering.interface';

/** The page to load with keyset (cursor) pagination, e.g. from query parameters. */
export interface CursorPaginationFilter {
  /** `nextCursor` of the previous page; missing, `null` or empty for the first page. */
  cursor?: string | null;
  /** Rows per page, 10 by default. */
  pageSize?: number;
}

/** A column that orders the rows of keyset pagination. */
export type CursorOrderParam<Entity> = {
  /** Property of the main entity. The column must not be `NULL`. */
  field: NonFunctionPropertyNames<Required<Entity>>;
  /** `'ASC'` by default. */
  direction?: OrderDirection;
};
