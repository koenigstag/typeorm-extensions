import { FindOperator, In, ObjectLiteral, Raw, WhereExpressionBuilder } from 'typeorm';
import { createUniqueParameterName } from './sql.utils';

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
  connection: { createQueryBuilder(): unknown };
  getWherePredicateCondition(aliasPath: string, parameterValue: unknown): unknown;
  createWhereConditionExpression(condition: unknown): string;
  getParameters(): ObjectLiteral;
};

const isPredicateRenderer = (value: unknown): value is PredicateRenderer => {
  const renderer = value as Partial<PredicateRenderer> | null;

  return (
    typeof renderer?.getWherePredicateCondition === 'function' &&
    typeof renderer.createWhereConditionExpression === 'function' &&
    typeof renderer.getParameters === 'function'
  );
};

const ORM_PARAMETER = /:orm_param_\d+\b/g;

// TypeORM 0.3.12 has no `or` FindOperatorType and doesn't render one
const OR = 'or' as FindOperator<unknown>['type'];

/** The operators `Not(…)`, `And(…)` or `Or(…)` combine; none for any other operator. */
function childOperators(operator: FindOperator<unknown>): FindOperator<unknown>[] | undefined {
  // `value` gives the value of a nested operator, `child` the operator itself
  if (operator.type === 'not') {
    return operator.child ? [operator.child] : undefined;
  }

  const value: unknown = operator.value;

  if (operator.type === 'and' || operator.type === OR) {
    return Array.isArray(value) && value.every(isFindOperator) ? value : undefined;
  }

  return undefined;
}

const holdsOr = (operator: FindOperator<unknown>): boolean =>
  operator.type === OR || (childOperators(operator) ?? []).some(holdsOr);

/**
 * The condition TypeORM's `find({ where })` writes for `operator` on `field`, with the operator's values set as
 * parameters of `builder`. TypeORM names them `orm_param_0`, `orm_param_1`… per builder, so a query that takes the
 * parameters of a subquery built on its own would get two `orm_param_0`: the operator is rendered on a builder of
 * its own and its values are set under unique names. `Or(…)`, and a `Not(…)` / `And(…)` holding one, is written
 * here, the same on every TypeORM version: `(a OR b)`, `NOT(a OR b)`.
 */
export function renderFindOperator(
  builder: WhereExpressionBuilder,
  field: string,
  operator: FindOperator<unknown>
): string {
  if (holdsOr(operator)) {
    const children = childOperators(operator) ?? [];
    const render = (child: FindOperator<unknown>): string =>
      child.type === OR ? `(${renderOrParts(builder, field, child)})` : renderFindOperator(builder, field, child);

    if (operator.type === 'not') {
      return `NOT(${children[0].type === OR ? renderOrParts(builder, field, children[0]) : render(children[0])})`;
    }

    if (operator.type === 'and') {
      return children.map(render).join(' AND ');
    }

    return `(${renderOrParts(builder, field, operator)})`;
  }

  const renderer = (builder as unknown as { connection?: { createQueryBuilder?: () => unknown } }).connection?.createQueryBuilder?.();

  if (!isPredicateRenderer(renderer)) {
    throw new TypeError(
      `This TypeORM version doesn't render find operators in a query builder; write the condition on "${field}" as SQL`
    );
  }

  const condition = renderer.createWhereConditionExpression(renderer.getWherePredicateCondition(field, operator));
  const parameters = renderer.getParameters();
  const names = new Map<string, string>();

  for (const name of Object.keys(parameters)) {
    names.set(name, /^orm_param_\d+$/.test(name) ? createUniqueParameterName('op') : name);
  }

  for (const [name, unique] of names) {
    (builder as unknown as { setParameter(key: string, value: unknown): void }).setParameter(unique, parameters[name]);
  }

  return condition.replace(ORM_PARAMETER, (placeholder) => `:${names.get(placeholder.slice(1)) ?? placeholder.slice(1)}`);
}

/** The operators of an `Or(…)` on `field`, joined by OR, without the parentheses around them. */
function renderOrParts(builder: WhereExpressionBuilder, field: string, operator: FindOperator<unknown>): string {
  const children = childOperators(operator) ?? [];

  if (!children.length) {
    throw new TypeError(`Or() on "${field}" has no operator to match: pass at least one`);
  }

  return children
    .map((child) => (child.type === OR ? `(${renderOrParts(builder, field, child)})` : renderFindOperator(builder, field, child)))
    .join(' OR ');
}

/**
 * The value a find operator compares with: the first one of a list, none for `IsNull()` or `Raw()`, the first value
 * one of its operators has for `Or(…)`.
 */
export function getFindOperatorValue(operator: FindOperator<unknown>): unknown {
  if (operator.type === 'not' && operator.child?.type === OR) {
    return getFindOperatorValue(operator.child);
  }

  if (operator.type === OR) {
    for (const child of childOperators(operator) ?? []) {
      const value = getFindOperatorValue(child);

      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

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
 * PostgreSQL never uses a partial index declared `WHERE col` / `WHERE col = true` for `col IS TRUE`: for a positive
 * filter on such a column use `Equal(true)`, which keeps the same rows in a `WHERE` clause.
 */
export function IsTrue(): FindOperator<boolean> {
  return Raw((field) => `${field} IS TRUE`) as FindOperator<boolean>;
}

/**
 * `IS FALSE` on a boolean column; `Not(IsFalse())` is `IS NOT FALSE` and matches NULL too. Like `IsTrue`, it never
 * uses a partial index declared `WHERE NOT col` / `WHERE col = false`: use `Equal(false)` for a positive filter.
 */
export function IsFalse(): FindOperator<boolean> {
  return Raw((field) => `${field} IS FALSE`) as FindOperator<boolean>;
}

/**
 * Matches when any of `operators` matches, `(op1 OR op2 …)` on the one column:
 * `whereTyped((s) => s.endedAt, Or(IsNull(), MoreThan(now)))` → `("s"."endedAt" IS NULL OR "s"."endedAt" > :op_…)`.
 * TypeORM's own `Or`, which TypeORM 0.3.12 lacks; the typed where methods and `whereExpression` write either one,
 * on every TypeORM version. `Not(Or(…))` negates it. Throws a `TypeError` without an operator.
 */
export function Or<T>(...operators: FindOperator<T>[]): FindOperator<T> {
  if (!operators.length || !operators.every(isFindOperator)) {
    throw new TypeError('Or() takes one find operator or more');
  }

  return new FindOperator<T>(OR, operators as unknown as T, true, true);
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
