import './declarations/get-many-with-totals.declaration';
import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { getLimitAndOffset } from '../utils/pagination.utils';
import './pagination.extension';
import type {
  ApplyPaginationOptions,
  GetManyWithTotalsOptions,
  ListWithTotals,
} from '../types/extensions';
import { patchPrototype } from '../utils/prototype.utils';

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    getManyWithTotals<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      paginationFilter: PaginationFilter,
      options?: GetManyWithTotalsOptions
    ): Promise<ListWithTotals<Entity>> {
      return getManyWithTotals<Entity>(this, paginationFilter, options);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

async function getManyWithTotals<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
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

  const requests: unknown[] = [];

  if (!disableTotalsCalculation) {
    requests[0] = await builder.getCount();
  } else {
    requests[0] = null;
  }

  if (loadAll) {
    requests[1] = await builder.getMany();
  } else {
    requests[1] = await builder
      .applyPaginationFilter(paginationFilter, paginationOptions)
      .getMany();
  }

  const [total, list] = requests as [number | null, Entity[]];

  return {
    list,
    total,
    limit,
    offset,
  };
}
