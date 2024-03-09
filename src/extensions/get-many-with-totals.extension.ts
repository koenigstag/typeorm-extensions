import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { getLimitAndOffset } from '../utils/pagination.utils';
import { ApplyPaginationOptions } from './pagination.extension';

export type GetManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};

export interface ListWithTotals<Entity> {
  list: Entity[];
  totalCount: number | null;
  limit: number | null;
  offset: number | null;
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    getManyWithTotals(
      paginationFilter: PaginationFilter,
      options?: GetManyWithTotalsOptions
    ): Promise<ListWithTotals<Entity>>;
  }
}

SelectQueryBuilder.prototype.getManyWithTotals = async function <Entity>(
  paginationFilter: PaginationFilter,
  options?: GetManyWithTotalsOptions & ApplyPaginationOptions
): Promise<ListWithTotals<Entity>> {
  const { disableTotalsCalculation = false, loadAll = false } = options || {};

  const { limit, offset } = loadAll
    ? { limit: null, offset: null }
    : getLimitAndOffset(paginationFilter);

  const requests = [];

  if (!disableTotalsCalculation) {
    requests[0] = this.getCount();
  } else {
    requests[0] = Promise.resolve(null);
  }

  if (loadAll) {
    requests[1] = this.getMany();
  } else {
    requests[1] = this.applyPaginationFilter(paginationFilter).getMany();
  }

  const [totalCount, list] = (await Promise.all(requests)) as [
    number | null,
    Entity[]
  ];

  return {
    list,
    totalCount: totalCount,
    limit,
    offset,
  };
};
