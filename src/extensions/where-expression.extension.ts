import { FindOperator, ObjectLiteral, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import { WhereMethods } from '../types/extensions';
import { isFindOperator, renderFindOperator } from '../utils/find-operator.utils';
import { addCondition, attachWhere } from '../utils/where.utils';

// declarations

/**
 * WHERE conditions on an SQL expression rather than a column: a function over columns (`coalesce(…)`, `lower(…)`), a
 * date expression, a value computed in a subquery. The expression is written as is, and compared through a TypeORM
 * find operator (`IsNull()`, `MoreThan(date)`, `Or(…)`) or an SQL condition, as `whereTyped` compares a column:
 * `whereExpression(Sql.coalesce(o.paidAt, o.createdAt), LessThan(since))`.
 */
export interface WhereExpressionMethods {
  /**
   * Sets WHERE condition on an SQL expression, written as is.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereExpression(
    expression: string,
    condition: string | FindOperator<unknown>,
    params?: unknown,
    options?: WhereExpressionOptions
  ): this;

  /** Adds new AND WHERE condition on an SQL expression, written as is. */
  andWhereExpression(
    expression: string,
    condition: string | FindOperator<unknown>,
    params?: unknown,
    options?: WhereExpressionOptions
  ): this;

  /** Adds new OR WHERE condition on an SQL expression, written as is. */
  orWhereExpression(
    expression: string,
    condition: string | FindOperator<unknown>,
    params?: unknown,
    options?: WhereExpressionOptions
  ): this;
}

export interface WhereExpressionOptions {
  /**
   * Whether a value from `params` is appended after an SQL condition under a unique placeholder (`'>'`, `since`).
   * Defaults to `true`, or to `false` when the condition already names a key of `params` (`'> :since'`).
   */
  addValue?: boolean;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereExpressionMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereExpressionMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereExpressionMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereExpressionMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereExpressionMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const createWhereExpressionMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    expression: string,
    condition: string | FindOperator<unknown>,
    params?: unknown,
    options?: WhereExpressionOptions
  ): SelectQueryBuilder<Entity> {
    return attachWhereExpression(this, method, expression, condition, params, options);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereExpression: createWhereExpressionMethod('where'),
    andWhereExpression: createWhereExpressionMethod('andWhere'),
    orWhereExpression: createWhereExpressionMethod('orWhere'),
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);

// implementation

function attachWhereExpression<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  expression: string,
  condition: string | FindOperator<unknown>,
  params?: unknown,
  options?: WhereExpressionOptions
): QB {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new TypeError(`${method}Expression expects an SQL expression, got ${JSON.stringify(expression)}`);
  }

  if (isFindOperator(condition)) {
    return addCondition(builder, method)(renderFindOperator(builder, expression, condition));
  }

  // a condition left out would widen the query: refuse what can't be written
  if (typeof condition !== 'string' || !condition.trim()) {
    throw new TypeError(
      `${method}Expression on "${expression}" expects a find operator or an SQL condition, got ${JSON.stringify(condition)}`
    );
  }

  return attachWhere(builder, method, expression, condition, params, { ...options, expression: true });
}
