import { FindOperator, In, Not, Raw, WhereExpressionBuilder } from 'typeorm';

// TypeORM marks its operators with a symbol instead of relying on `instanceof`, so an operator built by a second copy
// of TypeORM is recognized too; `Equal()` builds a subclass with a marker of its own
const FIND_OPERATOR_MARKERS = [Symbol.for('FindOperator'), Symbol.for('EqualOperator')];

/** Whether `value` is a TypeORM find operator: `IsNull()`, `Not(…)`, `In([…])`, `MoreThan(…)`, `Raw(…)`. */
export function isFindOperator(value: unknown): value is FindOperator<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    FIND_OPERATOR_MARKERS.includes((value as { '@instanceof'?: symbol })['@instanceof'] as symbol)
  );
}

type PredicateRenderer = {
  getWherePredicateCondition(aliasPath: string, parameterValue: unknown): unknown;
  createWhereConditionExpression(condition: unknown): string;
};

/**
 * The condition TypeORM's `find({ where })` writes for `operator` on `field`, with the operator's values set as
 * parameters of `builder`.
 */
export function renderFindOperator(
  builder: WhereExpressionBuilder,
  field: string,
  operator: FindOperator<unknown>
): string {
  const renderer = builder as unknown as Partial<PredicateRenderer>;

  if (
    typeof renderer.getWherePredicateCondition !== 'function' ||
    typeof renderer.createWhereConditionExpression !== 'function'
  ) {
    throw new TypeError(
      `This TypeORM version doesn't render find operators in a query builder; write the condition on "${field}" as SQL`
    );
  }

  return renderer.createWhereConditionExpression(renderer.getWherePredicateCondition(field, operator));
}

/** The value a find operator compares with: the first one of a list, none for `IsNull()` or `Raw()`. */
export function getFindOperatorValue(operator: FindOperator<unknown>): unknown {
  if (!operator.useParameter) {
    return undefined;
  }

  const value: unknown = operator.value;

  return operator.multipleParameters && Array.isArray(value) ? value[0] : value;
}

/**
 * TypeORM's `In([…])` with its values typed: TypeORM types `In()` as `FindOperator<any>`, so `In(['active'])` fits an
 * enum column and `IsIn(['active'])` doesn't. An empty list matches no row.
 */
export function IsIn<T>(values: readonly T[]): FindOperator<T> {
  return In(values) as FindOperator<T>;
}

/**
 * `Not(In([…]))` with its values typed, see `IsIn`. An empty list matches every row; like SQL `NOT IN`,
 * a row whose column is NULL never matches.
 */
export function IsNotIn<T>(values: readonly T[]): FindOperator<T> {
  return Not(In(values)) as FindOperator<T>;
}

/**
 * Compares the column with another column or SQL expression, which is written as is:
 * `whereTyped((o) => o.userId, EqualColumn(users.id))` → `"o"."userId" = "users"."id"`.
 * `Not(EqualColumn(…))` negates it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EqualColumn(column: string): FindOperator<any> {
  return Raw((field) => `${field} = ${column}`);
}
