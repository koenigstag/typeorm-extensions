import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** A part of a UNION: a query builder, or raw SQL whose placeholders read the outer builder's parameters. */
export type UnionQuery = string | { getQuery(): string; getParameters(): ObjectLiteral };

export type UnionOptions = {
  /** `UNION ALL`: keep duplicate rows. Defaults to `false`, `UNION`, which removes them. */
  all?: boolean;
};

/** TypeORM's options of `addCommonTableExpression` (`materialized`, `columnNames`), and `all`. */
export type UnionCteOptions = UnionOptions &
  NonNullable<Parameters<SelectQueryBuilder<ObjectLiteral>['addCommonTableExpression']>[2]>;
