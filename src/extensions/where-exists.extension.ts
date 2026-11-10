import {
  DeleteQueryBuilder,
  ObjectLiteral,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import type { WhereMethods } from '../types/extensions';
import { patchPrototype } from '../utils/prototype.utils';
import { createUniqueParameterName } from '../utils/sql.utils';

// declarations

/**
 * `EXISTS` conditions. TypeORM has them on `SelectQueryBuilder` only, and keeps its own there;
 * these add them to `UpdateQueryBuilder` and `DeleteQueryBuilder` with the same SQL. Unlike
 * TypeORM's, they add the subquery's parameters under unique names.
 */
export interface WhereExistsMethods {
  /** Sets `WHERE EXISTS (subQuery)`, replacing the WHERE conditions set before. */
  whereExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
  /** Adds `AND EXISTS (subQuery)`. */
  andWhereExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
  /** Adds `OR EXISTS (subQuery)`. */
  orWhereExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
}

/**
 * `NOT EXISTS` conditions: the negation of TypeORM's `whereExists`, with the same subquery SQL.
 * The subquery's parameters are added under unique names, so two subqueries can both use `:status`.
 */
export interface WhereNotExistsMethods {
  /** Sets `WHERE NOT EXISTS (subQuery)`, replacing the WHERE conditions set before. */
  whereNotExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
  /** Adds `AND NOT EXISTS (subQuery)`. */
  andWhereNotExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
  /** Adds `OR NOT EXISTS (subQuery)`. */
  orWhereNotExists<SubEntity extends ObjectLiteral>(subQuery: SelectQueryBuilder<SubEntity>): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereExistsMethods, WhereNotExistsMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereNotExistsMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral>
    extends WhereExistsMethods,
      WhereNotExistsMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

type SubQuery = SelectQueryBuilder<ObjectLiteral>;

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

// only where the builder lacks them: SelectQueryBuilder keeps TypeORM's own whereExists /
// andWhereExists / orWhereExists, and a later TypeORM that adds any of these keeps its own
[SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder, SoftDeleteQueryBuilder].forEach((builder) => {
  patchPrototype(builder, existsMethods, { onlyMissing: true });
  patchPrototype(builder, notExistsMethods, { onlyMissing: true });
});

// implementation

// TypeORM's placeholder syntax, `:name` and `:...name`, as its drivers match it
const PARAMETER_PLACEHOLDER = /:(\.\.\.)?([A-Za-z0-9_.]+)/g;

/**
 * Renames the subquery's parameters to unique names. A query has one parameter namespace, so two
 * subqueries with a `:status` each would otherwise both read whichever value was set last.
 */
function withUniqueParameterNames(
  condition: string,
  parameters: ObjectLiteral
): [string, ObjectLiteral] {
  const names = new Map(
    Object.keys(parameters).map((name) => [name, createUniqueParameterName(name)])
  );

  const sql = condition.replace(
    PARAMETER_PLACEHOLDER,
    (placeholder, spread: string | undefined, name: string) => {
      const unique = names.get(name);

      return unique ? `:${spread ?? ''}${unique}` : placeholder;
    }
  );

  const renamed = Object.fromEntries(
    Object.entries(parameters).map(([name, value]) => [names.get(name), value])
  );

  return [sql, renamed];
}

export function attachExists<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  subQuery: SubQuery,
  negate: boolean
): QB {
  const [condition, parameters] = withUniqueParameterNames(...getExistsCondition(subQuery));

  return builder[method](negate ? `NOT ${condition}` : condition, parameters) as QB;
}

/**
 * TypeORM's EXISTS condition: the subquery selects 1, without ORDER BY, LIMIT and OFFSET. TypeORM also
 * drops GROUP BY, which leaves a HAVING to aggregate the whole subquery: the GROUP BY stays with one.
 */
function getExistsCondition(subQuery: SubQuery): [string, ObjectLiteral] {
  const query = subQuery
    .clone()
    .orderBy()
    .offset(undefined)
    .limit(undefined)
    .skip(undefined)
    .take(undefined)
    .select('1')
    .setOption('disable-global-order');

  if (query.expressionMap.havings.length === 0) {
    query.groupBy();
  }

  return [`EXISTS (${query.getQuery()})`, query.getParameters()];
}
