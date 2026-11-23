/** An SQL expression that `orderByTyped` / `addOrderByTyped` and `distinctOnTyped` select once under a generated alias and refer to by it. */
export class SelectExpression {
  constructor(readonly sql: string) {}
}

/**
 * Orders by, or puts into DISTINCT ON, an SQL expression without a property on the entity to select it into:
 * `const rank = selectExpression('...')`, then `addOrderByTyped(rank, 'DESC')` and `distinctOnTyped(q => q.id, rank)`.
 * `getMany` leaves the value out of the entities.
 */
export const selectExpression = (sql: string): SelectExpression => new SelectExpression(sql);
