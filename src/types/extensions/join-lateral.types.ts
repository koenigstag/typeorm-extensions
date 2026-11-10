import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * The subquery of a LATERAL join: raw SQL (`SELECT … LIMIT 1`, without parentheses), a query
 * builder, or a factory that builds it on the query builder it is given, as for TypeORM's joins.
 */
export type LateralSubQuery<SubEntity extends ObjectLiteral = ObjectLiteral> =
  | string
  | SelectQueryBuilder<SubEntity>
  | ((qb: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>);
