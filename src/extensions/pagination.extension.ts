import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { PaginationFilter } from '../types/interfaces/pagination.interface';
import { defaultUseTakeAndSkip } from '../constants';
import { getLimitAndOffset } from '../utils/pagination.utils';

export type ApplyPaginationOptions = {
  useTakeAndSkip?: boolean;
};

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ): this;
  }
}

SelectQueryBuilder.prototype.applyPaginationFilter = function <Entity>(
  paginationFilter: PaginationFilter,
  options?: ApplyPaginationOptions
) {
  const { useTakeAndSkip = defaultUseTakeAndSkip } = options || {};

  const { limit, offset } = getLimitAndOffset(paginationFilter);

  if (useTakeAndSkip) {
    return this.take(limit).skip(offset);
  }

  return this.limit(limit).offset(offset);
};

export {};
