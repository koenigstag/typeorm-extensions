import './pagination.extension';
import { ObjectLiteral } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import type { QueryBuilder } from 'typeorm/query-builder/QueryBuilder';
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

/**
 * Whether the count and the page query may run at the same time. A builder bound to a query
 * runner — inside a transaction, or from a transactional manager — runs them one after another:
 * there is one connection, on which the driver would serialise them anyway, and on `pg` that queue
 * is deprecated. Without one, each query obtains a runner: its own pooled connection, or on SQLite
 * the driver's single shared runner.
 *
 * `useTransaction` is not consulted. With a pool each query opens a transaction on its own
 * connection, whether the two run together or one after another. On SQLite the two share the
 * runner, so the one that starts second finds a transaction active and does not open its own.
 */
function canCountConcurrently<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>
): boolean {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral> & {
    queryRunner?: QueryRunner;
  };

  return !queryBuilder.queryRunner;
}

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

  // without a total, one row past the page is what tells whether more rows follow
  const probeForMore = disableTotalsCalculation && !loadAll && limit !== null;

  const readPage = (): Promise<Entity[]> => {
    if (loadAll) {
      return builder.getMany();
    }

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

    return paged.getMany();
  };

  let total: number | null = null;
  let rows: Entity[];

  if (disableTotalsCalculation) {
    rows = await readPage();
  } else if (canCountConcurrently(builder)) {
    // the count goes on a clone, taken before readPage mutates the builder: the two queries would
    // otherwise share one expression map, which each of them writes to
    [total, rows] = await Promise.all([builder.clone().getCount(), readPage()]);
  } else {
    total = await builder.getCount();
    rows = await readPage();
  }

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
