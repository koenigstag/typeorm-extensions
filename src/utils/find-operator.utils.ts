import { FindOperator, In, Raw, WhereExpressionBuilder } from 'typeorm';

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
 * enum column and `IsIn(['active'])` doesn't. An empty list matches no row; `Not(IsIn([…]))` negates it, typed too.
 */
export function IsIn<T>(values: readonly T[]): FindOperator<T> {
  return In(values) as FindOperator<T>;
}

let parameterCount = 0;

// Raw() sets its parameters under the names it is given: a name per operator keeps two of them in one query apart
const parameterName = (prefix: string): string => `${prefix}_${++parameterCount}`;

/**
 * `IS DISTINCT FROM :value`: unlike `<>`, true when one side is NULL and the other isn't, false for two NULLs.
 * `Not(IsDistinctFrom(value))` is an `=` that matches NULL to NULL. PostgreSQL, SQLite 3.39+; on MySQL and MariaDB,
 * `whereIsDistinctFrom`, which writes `<=>`. The value may be `null` for any column.
 */
export function IsDistinctFrom(value: null): FindOperator<never>;
export function IsDistinctFrom<T>(value: T | null): FindOperator<T>;
export function IsDistinctFrom<T>(value: T | null): FindOperator<T> {
  const name = parameterName('isDistinctFrom');

  return Raw((field) => `${field} IS DISTINCT FROM :${name}`, { [name]: value }) as FindOperator<T>;
}

/**
 * `IS TRUE` on a boolean column. Unlike `= true` it is never NULL, so `Not(IsTrue())` is `IS NOT TRUE` and
 * matches NULL too, while `Not(Equal(true))` skips it. PostgreSQL, SQLite 3.23+, MySQL.
 */
export function IsTrue(): FindOperator<boolean> {
  return Raw((field) => `${field} IS TRUE`) as FindOperator<boolean>;
}

/** `IS FALSE` on a boolean column; `Not(IsFalse())` is `IS NOT FALSE` and matches NULL too, see `IsTrue`. */
export function IsFalse(): FindOperator<boolean> {
  return Raw((field) => `${field} IS FALSE`) as FindOperator<boolean>;
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
