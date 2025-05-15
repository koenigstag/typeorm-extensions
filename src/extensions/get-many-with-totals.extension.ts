import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { getLimitAndOffset } from '../utils/pagination.utils';
import { ApplyPaginationOptions } from './pagination.extension';
import './pagination.extension';

export type GetManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};

export interface ListWithTotals<Entity> {
  list: Entity[];
  total: number | null;
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
  const {
    disableTotalsCalculation = false,
    loadAll = false,
    ...paginationOptions
  } = options || {};

  const { limit, offset } = loadAll
    ? { limit: null, offset: null }
    : getLimitAndOffset(paginationFilter);

  const requests: any[] = [];

  if (!disableTotalsCalculation) {
    requests[0] = await this.getCount();
  } else {
    requests[0] = null;
  }

  if (loadAll) {
    requests[1] = await this.getMany();
  } else {
    requests[1] = await this.applyPaginationFilter(
      paginationFilter,
      paginationOptions
    ).getMany();
  }

  const [total, list] = requests as [number | null, Entity[]];

  return {
    list,
    total,
    limit,
    offset,
  };
};
