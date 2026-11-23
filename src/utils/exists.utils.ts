import type { ObjectLiteral, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { WhereMethods } from '../types/extensions';
import type { SubQuery } from '../types/extensions/sub-query.types';
import { detachedQueryBuilder, withUniqueParameterNames } from './parameter.utils';
import { withoutPaging } from './query-builder.utils';

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
export function toExistsSql(builder: WhereExpressionBuilder, subQuery: SubQuery, negate: boolean): string {
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
