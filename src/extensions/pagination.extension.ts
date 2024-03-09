import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { PaginationFilter } from '../types/interfaces/pagination.interface';
import { defaultUseTakeAndSkip } from '../constants';
import { getLimitAndOffset } from '../utils/pagination.utils';
import { ObjectLiteral } from 'typeorm';

export type ApplyPaginationOptions = {
  useTakeAndSkip?: boolean;
};

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.applyPaginationFilter = function <Entity extends ObjectLiteral>(
  paginationFilter: PaginationFilter,
  options?: ApplyPaginationOptions
): SelectQueryBuilder<Entity> {
  const { useTakeAndSkip = defaultUseTakeAndSkip } = options || {};

  const { limit, offset } = getLimitAndOffset(paginationFilter);

  if (useTakeAndSkip) {
    return this.take(limit).skip(offset);
  }

  return this.limit(limit).offset(offset);
};

export {};
