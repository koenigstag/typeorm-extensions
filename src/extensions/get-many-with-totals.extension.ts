import './pagination.extension';
import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { getLimitAndOffset } from '../utils/pagination.utils';
import { defaultUseTakeAndSkip } from '../constants';
import type {
  ApplyPaginationOptions,
  GetManyWithTotalsOptions,
  ListWithTotals,
} from '../types/extensions';
import type { OrderType } from '../types/interfaces/ordering.interface';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    getManyWithTotals(
      paginationFilter: PaginationFilter,
      options?: GetManyWithTotalsOptions
    ): Promise<ListWithTotals<Entity>>;
  }
}

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

  const requests: [number | null, Entity[]] = [null, []];

  if (!disableTotalsCalculation) {
    requests[0] = await builder.getCount();
  }

  // without a total, one row past the page is what tells whether more rows follow
  const probeForMore = disableTotalsCalculation && !loadAll && limit !== null;

  if (loadAll) {
    requests[1] = await builder.getMany();
  } else {
    const paged = builder.applyPaginationFilter(
      paginationFilter,
      paginationOptions
    );

    if (probeForMore) {
      const probeLimit = limit + 1;
      const { useTakeAndSkip = defaultUseTakeAndSkip } = paginationOptions;

      // replaces the limit applyPaginationFilter just set, keeping its offset
      if (useTakeAndSkip) {
        paged.take(probeLimit);
      } else {
        paged.limit(probeLimit);
      }
    }

    requests[1] = await paged.getMany();
  }

  const [total, rows] = requests;

  let list = rows;
  let hasMore: boolean | null;

  if (probeForMore) {
    hasMore = rows.length > limit;
    list = hasMore ? rows.slice(0, limit) : rows;
  } else {
    hasMore =
      total !== null && offset !== null ? offset + rows.length < total : null;
  }

  // allOrderBys, not orderBys: it is what the SQL is built from, so without an explicit order it
  // falls back to the `orderBy` of @Entity, and respects the `disable-global-order` option
  const orderBy: OrderType[] = Object.entries(
    builder.expressionMap.allOrderBys ?? {}
  ).map(([selector, value]) =>
    typeof value === 'string'
      ? { selector, order: value }
      : { selector, order: value.order, nulls: value.nulls }
  );

  return {
    list,
    total,
    limit,
    offset,
    hasMore,
    orderBy,
  };
}
