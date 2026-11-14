import './pagination.extension';
import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { getLimitAndOffset, paginateQuery, setPageLimit } from '../utils/pagination.utils';
import { defaultUseTakeAndSkip } from '../constants';
import type {
  ApplyPaginationOptions,
  GetManyWithTotalsOptions,
  GetRawManyWithTotalsOptions,
  ListWithTotals,
} from '../types/extensions';
import { patchPrototype } from '../utils/prototype.utils';
import { getAppliedOrderBy, getQueryRunner, withoutPaging } from '../utils/query-builder.utils';

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
  return !getQueryRunner(builder);
}

function getManyWithTotals<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  paginationFilter: PaginationFilter,
  options?: GetManyWithTotalsOptions & ApplyPaginationOptions
): Promise<ListWithTotals<Entity>> {
  return readWithTotals<Entity, Entity>(builder, paginationFilter, options, {
    rows: (query) => query.getMany(),
    // on a clone: getCount writes to the expression map the page query reads
    count: (query) => cloneForCount(query).getCount(),
  });
}

/** A clone with a cache id of its own: under the page query's id each would read the other's cached rows. */
function cloneForCount<Entity extends ObjectLiteral>(query: SelectQueryBuilder<Entity>): SelectQueryBuilder<Entity> {
  const clone = query.clone();

  if (clone.expressionMap.cacheId) {
    clone.expressionMap.cacheId = `${clone.expressionMap.cacheId}-count`;
  }

  return clone;
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

  const { limit, offset, page, pageSize } = loadAll
    ? { limit: null, offset: null, page: null, pageSize: null }
    : getLimitAndOffset(paginationFilter);

  // without a total, one row past the page is what tells whether more rows follow
  const probeForMore = disableTotalsCalculation && !loadAll && limit !== null;

  const readPage = (): Promise<Row[]> => {
    if (loadAll) {
      return read.rows(builder);
    }

    const paged = paginateQuery(builder, paginationFilter, paginationOptions);

    if (probeForMore) {
      const { useTakeAndSkip = defaultUseTakeAndSkip } = paginationOptions;

      // replaces the limit paginateQuery just set, keeping its offset
      setPageLimit(paged, limit + 1, useTakeAndSkip);
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
    const counting = read.count(builder);
    // a page that throws before its query starts (a limit TypeORM rejects) waits for the count too
    const reading = new Promise<Row[]>((resolve) => resolve(readPage()));

    [total, rows] = await bothOrFirstError(counting, reading);
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

  return {
    list,
    total,
    page,
    pageSize,
    limit,
    offset,
    hasMore,
    orderBy: getAppliedOrderBy(builder),
  };
}

/**
 * Both results, or the first error once both queries have settled. `Promise.all` alone would reject as soon as
 * one fails, while the other still runs on its own connection: the call would return with a query in flight,
 * whose outcome nobody reads. When both fail, the count's error is thrown, being the first query started.
 */
async function bothOrFirstError<A, B>(first: Promise<A>, second: Promise<B>): Promise<[A, B]> {
  const [a, b] = await Promise.all([settle(first), settle(second)]);

  // `=== false`: without strictNullChecks `!fulfilled` doesn't narrow the union
  if (a.fulfilled === false) {
    throw a.reason;
  }

  if (b.fulfilled === false) {
    throw b.reason;
  }

  return [a.value, b.value];
}

type Settled<T> = { fulfilled: true; value: T } | { fulfilled: false; reason: unknown };

// Promise.allSettled is ES2020, past the ES2019 target of the build
function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ fulfilled: true as const, value }),
    (reason: unknown) => ({ fulfilled: false as const, reason })
  );
}

type NativeParametersSetter = { setNativeParameters(parameters: ObjectLiteral): unknown };

/**
 * Counts the rows of a raw query without its pagination and ORDER BY. The query goes into a
 * subquery, so the count is that of its result rows whatever it groups or filters. A
 * `countExpression` replaces the select list instead, without GROUP BY, HAVING and DISTINCT.
 * Builds the count query before its first `await`, so the builder may change afterwards.
 */
async function countRawRows<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  countExpression?: string
): Promise<number> {
  const unpaged = withoutPaging(cloneForCount(builder));

  type CountRow = { count: number | string };
  let counting: Promise<CountRow | undefined>;

  if (countExpression) {
    // the expression counts on its own: DISTINCT ON next to an aggregate is an error
    const counter = unpaged.select(countExpression, 'count').groupBy().distinct(false).distinctOn([]);
    counter.expressionMap.havings = [];
    counting = counter.getRawOne<CountRow>();
  } else {
    // on the builder's query runner, if it has one: inside its transaction
    const counter = builder.connection
      .createQueryBuilder(getQueryRunner(builder))
      .select('COUNT(*)', 'count')
      .from(`(${unpaged.getQuery()})`, 'counted')
      .setParameters(unpaged.getParameters());
    // TypeORM 0.3's `$1` / `?` parameters; 1.x has none
    const { nativeParameters } = unpaged.expressionMap as { nativeParameters?: ObjectLiteral };

    if (nativeParameters) {
      (counter as unknown as NativeParametersSetter).setNativeParameters(nativeParameters);
    }

    const { cache, cacheId, cacheDuration } = unpaged.expressionMap;
    Object.assign(counter.expressionMap, { cache, cacheId, cacheDuration });
    counting = counter.getRawOne<CountRow>();
  }

  // COUNT is a bigint on PostgreSQL, which the driver hands over as a string
  const row = await counting;

  return Number(row?.count ?? 0);
}
