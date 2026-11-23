import type { SelectQueryBuilder } from 'typeorm';

/**
 * What a map join joins, as TypeORM's `leftJoinAndMapOne` and the others take it: an entity class or name, a
 * relation (`'user.photos'`), a table name, or a factory that builds a subquery on the query builder it is given.
 */
export type JoinAndMapTarget =
  // eslint-disable-next-line @typescript-eslint/ban-types
  | Function
  | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>);
