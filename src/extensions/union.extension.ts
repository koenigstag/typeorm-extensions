import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { UnionCteOptions, UnionOptions, UnionQuery } from '../types/extensions/union.types';
import { patchPrototype } from '../utils/prototype.utils';
import { toSubQuerySql } from '../utils/parameter.utils';
import { getDriverType, isSqliteLikeDriver } from '../utils/sql.utils';

// declarations

export interface UnionMethods {
  /**
   * Selects FROM the UNION of `queries`, as `alias`: `FROM ((A) UNION (B)) "alias"`.
   *
   * Unlike pasting `${a.getQuery()} UNION ${b.getQuery()}` and merging `getParameters()`, the
   * parameters of each query are renamed: two queries with a `:status` of their own each keep
   * their value, where a merged object keeps only the last one. A raw SQL string is used as is,
   * its placeholders read the parameters of this builder.
   */
  fromUnion(queries: readonly UnionQuery[], alias: string, options?: UnionOptions): this;

  /**
   * Adds a common table expression (WITH) that is the UNION of `queries`:
   * `WITH "alias" AS ((A) UNION (B))`. Parameters are renamed as in `fromUnion`.
   */
  addCommonTableExpressionUnion(queries: readonly UnionQuery[], alias: string, options?: UnionCteOptions): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends UnionMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    fromUnion<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      queries: readonly UnionQuery[],
      alias: string,
      options?: UnionOptions
    ) {
      return this.from(`(${unionSql(this, 'fromUnion', queries, options)})`, alias);
    },

    addCommonTableExpressionUnion<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      queries: readonly UnionQuery[],
      alias: string,
      options?: UnionCteOptions
    ) {
      const { all, ...cteOptions } = options ?? {};

      return this.addCommonTableExpression(
        unionSql(this, 'addCommonTableExpressionUnion', queries, { all }),
        alias,
        cteOptions
      );
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

/** The UNION of `queries`, with the parameters of each set on `builder` under unique names. */
function unionSql<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  methodName: string,
  queries: readonly UnionQuery[],
  options?: UnionOptions
): string {
  if (!queries.length) {
    throw new TypeError(`${methodName}: no queries to union`);
  }

  const sqlite = isSqliteLikeDriver(getDriverType(builder));

  const branches = queries.map((query) => {
    const sql = typeof query === 'string' ? query : bindParameters(builder, query);

    if (!sqlite) {
      return `(${sql})`;
    }

    // SQLite takes neither parentheses around a part of a UNION nor an ORDER BY / LIMIT inside one
    // (a query of an entity with a default `orderBy` has an ORDER BY): such a part becomes a subquery.
    // Only such a part: the recursive part of a CTE can't refer to the CTE from a subquery
    return ordersOrLimits(query, sql) ? `SELECT * FROM (${sql})` : sql;
  });

  return branches.join(options?.all ? ' UNION ALL ' : ' UNION ');
}

const ORDER_OR_LIMIT = /\b(?:ORDER\s+BY|LIMIT|OFFSET)\b/i;

function ordersOrLimits(query: UnionQuery, sql: string): boolean {
  if (typeof query === 'string' || !('expressionMap' in query)) {
    return ORDER_OR_LIMIT.test(sql);
  }

  const { allOrderBys, limit, offset, take, skip } = (query as SelectQueryBuilder<ObjectLiteral>).expressionMap;

  return Object.keys(allOrderBys ?? {}).length > 0 || [limit, offset, take, skip].some((value) => value !== undefined);
}

function bindParameters<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  query: Exclude<UnionQuery, string>
): string {
  const [sql, parameters] = toSubQuerySql(query);

  builder.setParameters(parameters);

  return sql;
}
