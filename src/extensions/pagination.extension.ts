import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { PaginationFilter } from '../types/interfaces/pagination.interface';
import { defaultPageSize, defaultUseTakeAndSkip } from '../constants';
import { getLimitAndOffset } from '../utils/pagination.utils';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: { useTakeAndSkip?: boolean }
    ): this;
  }
}

SelectQueryBuilder.prototype.applyPaginationFilter = function <Entity>(
  paginationFilter: PaginationFilter,
  options?: { useTakeAndSkip?: boolean }
) {
  if (!paginationFilter?.pageSize) {
    return this;
  }

  const { useTakeAndSkip = defaultUseTakeAndSkip } = options || {};

  const { limit, offset } = getLimitAndOffset(paginationFilter);

  if (useTakeAndSkip) {
    return this.take(limit).skip(offset);
  }

  return this.limit(limit).offset(offset);
};

export {};
