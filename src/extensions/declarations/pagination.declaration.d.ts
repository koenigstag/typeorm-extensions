import type { PaginationFilter } from '../../types/interfaces/pagination.interface';
import type { ApplyPaginationOptions } from '../../types/extensions/pagination.types';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ): SelectQueryBuilder<Entity>;
  }
}
