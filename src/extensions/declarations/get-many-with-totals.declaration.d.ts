import type { PaginationFilter } from '../../types/interfaces/pagination.interface';
import type { GetManyWithTotalsOptions, ListWithTotals } from '../../types/extensions/get-many-with-totals.types';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    getManyWithTotals(
      paginationFilter: PaginationFilter,
      options?: GetManyWithTotalsOptions
    ): Promise<ListWithTotals<Entity>>;
  }
}