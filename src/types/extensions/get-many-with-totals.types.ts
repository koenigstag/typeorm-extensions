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
}
