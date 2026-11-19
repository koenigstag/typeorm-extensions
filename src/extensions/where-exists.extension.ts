import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import type { WhereMethods } from '../types/extensions';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import { detachedQueryBuilder, withUniqueParameterNames } from '../utils/parameter.utils';
import { withoutPaging } from '../utils/query-builder.utils';

// declarations

/**
 * `EXISTS` conditions. TypeORM has them on `SelectQueryBuilder` only, and keeps its own there;
 * these add them to `UpdateQueryBuilder` and `DeleteQueryBuilder` with the same SQL. Unlike
 * TypeORM's, they add the subquery's parameters under unique names.
 */
export interface WhereExistsMethods {
  /** Sets `WHERE EXISTS (subQuery)`, replacing the WHERE conditions set before. */
  whereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
  /** Adds `AND EXISTS (subQuery)`. */
  andWhereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
  /** Adds `OR EXISTS (subQuery)`. */
  orWhereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
}

/**
 * The subquery of an EXISTS condition: a query builder, or a factory that builds it on the builder it is given
 * (`sub => sub.select('1').from(Image, 'image').where(…)`), one of the same connection and transaction.
 */
export type ExistsSubQuery<SubEntity extends ObjectLiteral> =
  | SelectQueryBuilder<SubEntity>
  | ((subQuery: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>);

/** The factory form of an `ExistsSubQuery`. */
export type ExistsSubQueryFactory<SubEntity extends ObjectLiteral> = Extract<ExistsSubQuery<SubEntity>, (...args: never[]) => unknown>;

/**
 * `NOT EXISTS` conditions: the negation of TypeORM's `whereExists`, with the same subquery SQL.
 * The subquery's parameters are added under unique names, so two subqueries can both use `:status`.
 */
export interface WhereNotExistsMethods {
  /** Sets `WHERE NOT EXISTS (subQuery)`, replacing the WHERE conditions set before. */
  whereNotExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
  /** Adds `AND NOT EXISTS (subQuery)`. */
  andWhereNotExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
  /** Adds `OR NOT EXISTS (subQuery)`. */
  orWhereNotExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): this;
}

/**
 * `EXISTS (subquery)` and `NOT EXISTS (subquery)` as SQL, for a place the `where*Exists` methods don't reach: an `OR`
 * group, a `CASE`, a selection, an ordering, a join condition. The subquery is built as for `whereExists`; its
 * parameters get unique names and are set on this query when the method is called, so the SQL can go anywhere in it:
 * `.where((qb) => \`"user"."id" = :id OR ${qb.existsSql((sub) => …)}\`, { id })`.
 */
export interface ExistsSqlMethods {
  /** Returns `EXISTS (subQuery)`, and sets the subquery's parameters on this query. */
  existsSql<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): string;
  /** Returns `NOT EXISTS (subQuery)`, and sets the subquery's parameters on this query. */
  notExistsSql<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQuery<SubEntity>): string;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereExistsMethods, WhereNotExistsMethods, ExistsSqlMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereNotExistsMethods, ExistsSqlMethods {
    // TypeORM's own EXISTS methods take a builder; these overloads add the factory form
    whereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQueryFactory<SubEntity>): this;
    andWhereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQueryFactory<SubEntity>): this;
    orWhereExists<SubEntity extends ObjectLiteral>(subQuery: ExistsSubQueryFactory<SubEntity>): this;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods,
      ExistsSqlMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods,
      ExistsSqlMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods,
      ExistsSqlMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

type SubQuery = ExistsSubQuery<ObjectLiteral>;

const existsMethods: { prototype: WhereExistsMethods } = {
  prototype: {
    whereExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'where', subQuery, false);
    },
    andWhereExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'andWhere', subQuery, false);
    },
    orWhereExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'orWhere', subQuery, false);
    },
  } as WhereExistsMethods,
};

const notExistsMethods: { prototype: WhereNotExistsMethods } = {
  prototype: {
    whereNotExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'where', subQuery, true);
    },
    andWhereNotExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'andWhere', subQuery, true);
    },
    orWhereNotExists(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return attachExists(this, 'orWhere', subQuery, true);
    },
  } as WhereNotExistsMethods,
};

const existsSqlMethods: { prototype: ExistsSqlMethods } = {
  prototype: {
    existsSql(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return toExistsSql(this, subQuery, false);
    },
    notExistsSql(this: WhereExpressionBuilder, subQuery: SubQuery) {
      return toExistsSql(this, subQuery, true);
    },
  } as ExistsSqlMethods,
};

// only where the builder lacks them: SelectQueryBuilder keeps TypeORM's own whereExists /
// andWhereExists / orWhereExists, and a later TypeORM that adds any of these keeps its own
patchPrototypes(WHERE_QUERY_BUILDERS, existsMethods, { onlyMissing: true });
patchPrototypes(WHERE_QUERY_BUILDERS, notExistsMethods, { onlyMissing: true });
patchPrototypes(WHERE_QUERY_BUILDERS, existsSqlMethods, { onlyMissing: true });

// TypeORM's own select EXISTS methods keep handling a builder; a factory goes through ours
for (const [name, method] of [['whereExists', 'where'], ['andWhereExists', 'andWhere'], ['orWhereExists', 'orWhere']] as const) {
  const prototype = SelectQueryBuilder.prototype as unknown as Record<string, (subQuery: SubQuery) => unknown>;
  const own = prototype[name];

  if (own !== existsMethods.prototype[name]) {
    prototype[name] = function (this: SelectQueryBuilder<ObjectLiteral>, subQuery: SubQuery) {
      return typeof subQuery === 'function' ? attachExists(this, method, subQuery, false) : own.call(this, subQuery);
    };
  }
}

// implementation

export function attachExists<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  subQuery: SubQuery,
  negate: boolean
): QB {
  const [condition, parameters] = buildExists(builder, subQuery, negate);

  return builder[method](condition, parameters) as QB;
}

/** The SQL of `existsSql` / `notExistsSql`: the condition, with the subquery's parameters set on `builder`. */
function toExistsSql(builder: WhereExpressionBuilder, subQuery: SubQuery, negate: boolean): string {
  const [condition, parameters] = buildExists(builder, subQuery, negate);

  // every builder has setParameters; WhereExpressionBuilder, the type Brackets passes, doesn't declare it
  (builder as unknown as Pick<SelectQueryBuilder<ObjectLiteral>, 'setParameters'>).setParameters(parameters);

  return condition;
}

/** The EXISTS condition of a subquery or of the one a factory builds on `builder`'s connection, with unique parameter names. */
function buildExists(builder: WhereExpressionBuilder, subQuery: SubQuery, negate: boolean): [string, ObjectLiteral] {
  const query = typeof subQuery === 'function' ? subQuery(detachedQueryBuilder(builder)) : subQuery;
  const [condition, parameters] = withUniqueParameterNames(...getExistsCondition(query));

  return [negate ? `NOT ${condition}` : condition, parameters];
}

/**
 * TypeORM's EXISTS condition: the subquery selects 1, without ORDER BY, LIMIT and OFFSET. TypeORM also
 * drops GROUP BY, which leaves a HAVING to aggregate the whole subquery: with a HAVING the GROUP BY
 * stays, and so do the aliased selections, which a HAVING may name on MySQL and SQLite (`cnt > 1`).
 * An entity's own columns go either way: next to a GROUP BY they would not be grouped.
 */
function getExistsCondition(subQuery: SelectQueryBuilder<ObjectLiteral>): [string, ObjectLiteral] {
  const query = withoutPaging(subQuery.clone());
  const aliased = query.expressionMap.selects.filter((select) => select.aliasName !== undefined);

  query.select('1');

  if (query.expressionMap.havings.length === 0) {
    query.groupBy();
  } else {
    aliased.forEach((select) => query.addSelect(select.selection, select.aliasName));
  }

  return [`EXISTS (${query.getQuery()})`, query.getParameters()];
}
