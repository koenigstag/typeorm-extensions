import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * A subquery: a query builder, or a factory that builds it on the builder it is given
 * (`sub => sub.select('1').from(Image, 'image').where(…)`), one of the outer query's connection and transaction.
 */
export type SubQuery<Entity extends ObjectLiteral = ObjectLiteral> =
  | SelectQueryBuilder<Entity>
  | ((subQuery: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<Entity>);

/** The factory form of a `SubQuery`. */
export type SubQueryFactory<Entity extends ObjectLiteral = ObjectLiteral> = Extract<SubQuery<Entity>, (...args: never[]) => unknown>;
