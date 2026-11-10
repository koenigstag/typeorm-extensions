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
  GetRawManyWithTotalsOptions,
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

    /**
     * `getManyWithTotals` for raw rows: the page comes from `getRawMany()`, paged with LIMIT / OFFSET.
     * `total` is the number of rows the query returns without pagination, counted as a subquery,
     * `SELECT COUNT(*) FROM (query)`, so GROUP BY, HAVING and DISTINCT count the way they page.
     * `options.countExpression` counts with an expression of the query instead.
     */
    getRawManyWithTotals<Row = ObjectLiteral>(
      paginationFilter: PaginationFilter,
      options?: GetRawManyWithTotalsOptions
    ): Promise<ListWithTotals<Row>>;
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
    getRawManyWithTotals<Entity extends ObjectLiteral, Row = ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      paginationFilter: PaginationFilter,
      options?: GetRawManyWithTotalsOptions
    ): Promise<ListWithTotals<Row>> {
      return getRawManyWithTotals<Entity, Row>(this, paginationFilter, options);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

/**
 * Whether the count and the page query may run at the same time. Each needs a connection of its
 * own, so a builder bound to one query runner — inside a transaction, or from a transactional
 * manager — runs them one after another: on a single connection the driver serialises them anyway,
 * and on `pg` that queue is deprecated.
 *
 * `useTransaction` is not consulted: without a query runner of its own each call obtains one and
 * opens its own transaction, whether the two run together or one after another, so the flag never
 * made them share anything.
 */
function canCountConcurrently<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>
): boolean {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral> & {
    queryRunner?: QueryRunner;
  };

  return !queryBuilder.queryRunner;
}

function getManyWithTotals<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter,
  options?: GetManyWithTotalsOptions & ApplyPaginationOptions
): Promise<ListWithTotals<Entity>> {
  return readWithTotals<Entity, Entity>(builder, paginationFilter, options, {
    rows: (query) => query.getMany(),
    // on a clone: getCount writes to the expression map the page query reads
    count: (query) => query.clone().getCount(),
  });
}

function getRawManyWithTotals<Entity extends ObjectLiteral, Row>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter,
  options?: GetRawManyWithTotalsOptions
): Promise<ListWithTotals<Row>> {
  const { countExpression, ...totalsOptions } = options ?? {};

  // take / skip page entities; raw rows are paged with LIMIT / OFFSET
  return readWithTotals<Entity, Row>(
    builder,
    paginationFilter,
    { ...totalsOptions, useTakeAndSkip: false },
    {
      rows: (query) => query.getRawMany<Row>(),
      count: (query) => countRawRows(query, countExpression),
    }
  );
}

type RowsReader<Entity extends ObjectLiteral, Row> = {
  rows(query: SelectQueryBuilder<Entity>): Promise<Row[]>;
  /** Counts the rows of the query without pagination. Leaves the builder as it is. */
  count(query: SelectQueryBuilder<Entity>): Promise<number>;
};

async function readWithTotals<Entity extends ObjectLiteral, Row>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter,
  options: (GetManyWithTotalsOptions & ApplyPaginationOptions) | undefined,
  read: RowsReader<Entity, Row>
): Promise<ListWithTotals<Row>> {
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

  const readPage = (): Promise<Row[]> => {
    if (loadAll) {
      return read.rows(builder);
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

    return read.rows(paged);
  };

  let total: number | null = null;
  let rows: Row[];

  if (disableTotalsCalculation) {
    rows = await readPage();
  } else if (canCountConcurrently(builder)) {
    // the count clones the builder before readPage mutates it, so it has to start first: the two
    // queries would otherwise share one expression map, which each of them writes to
    [total, rows] = await bothOrFirstError(read.count(builder), readPage());
  } else {
    total = await read.count(builder);
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

/**
 * Both results, or the first error once both queries have settled. `Promise.all` would reject as soon as
 * one fails, while the other still runs on its own connection: the call would return with a query in flight,
 * whose outcome nobody reads. When both fail, the count's error is thrown, being the first query started.
 */
async function bothOrFirstError<A, B>(first: Promise<A>, second: Promise<B>): Promise<[A, B]> {
  const [a, b] = await Promise.allSettled([first, second]);

  if (a.status === 'rejected') {
    throw a.reason;
  }

  if (b.status === 'rejected') {
    throw b.reason;
  }

  return [a.value, b.value];
}

function getQueryRunner<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>
): QueryRunner | undefined {
  return (builder as unknown as { queryRunner?: QueryRunner }).queryRunner;
}

/**
 * Counts the rows of a raw query without its pagination and ORDER BY. The query goes into a
 * subquery, so the count is that of its result rows whatever it groups or filters. A
 * `countExpression` replaces the select list instead, without GROUP BY and HAVING.
 * Builds the count query before its first `await`, so the builder may change afterwards.
 */
async function countRawRows<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  countExpression?: string
): Promise<number> {
  const unpaged = builder
    .clone()
    .orderBy()
    .offset(undefined)
    .limit(undefined)
    .skip(undefined)
    .take(undefined)
    .setOption('disable-global-order');

  type CountRow = { count: number | string };
  let counting: Promise<CountRow | undefined>;

  if (countExpression) {
    const counter = unpaged.select(countExpression, 'count').groupBy();
    counter.expressionMap.havings = [];
    counting = counter.getRawOne<CountRow>();
  } else {
    // on the builder's query runner, if it has one: inside its transaction
    counting = builder.connection
      .createQueryBuilder(getQueryRunner(builder))
      .select('COUNT(*)', 'count')
      .from(`(${unpaged.getQuery()})`, 'counted')
      .setParameters(unpaged.getParameters())
      .getRawOne<CountRow>();
  }

  // COUNT is a bigint on PostgreSQL, which the driver hands over as a string
  const row = await counting;

  return Number(row?.count ?? 0);
}
