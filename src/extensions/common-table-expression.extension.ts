import { ObjectLiteral, QueryBuilder } from 'typeorm';

// TypeORM hands the parameters of a CTE given as a builder to the query only while it writes the WITH clause.
// getMany / getOne with take or skip and a join write that SQL on a clone for their DISTINCT id query, then bind
// the original's getParameters(), which lacked them: the query failed on the unbound placeholder.
const { getParameters } = QueryBuilder.prototype;

QueryBuilder.prototype.getParameters = function (this: QueryBuilder<ObjectLiteral>): ObjectLiteral {
  const parameters = getParameters.call(this);

  for (const { queryBuilder } of this.expressionMap.commonTableExpressions ?? []) {
    if (typeof queryBuilder !== 'string') {
      // over the query's own, as writing the WITH clause sets them
      Object.assign(parameters, queryBuilder.getParameters());
    }
  }

  return parameters;
};
