import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { PaginationFilter } from '../types/interfaces/pagination.interface';
import { defaultPageSize, defaultUseTakeAndSkip } from '../constants';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: { useTakeAndSkip?: boolean }
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.applyPaginationFilter = function <Entity>(
  paginationFilter: PaginationFilter,
  options?: { useTakeAndSkip?: boolean }
) {
  if (!paginationFilter?.pageSize) {
    return this;
  }

  const { page = 1, pageSize = defaultPageSize } = paginationFilter;
  const { useTakeAndSkip = defaultUseTakeAndSkip } = options ?? {};

  const offset = (page >= 1 ? page - 1 : 0) * pageSize;
  const limit = pageSize;

  if (useTakeAndSkip) {
    return this.take(limit).skip(offset);
  }

  return this.limit(limit).offset(offset);
};

export {};
