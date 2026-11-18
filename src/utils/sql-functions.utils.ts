import { filtered } from './table.utils';

export type SqlAggregateOptions = {
  /** Each value once: `COUNT(DISTINCT expression)`. */
  distinct?: boolean;
  /** Aggregates only the rows that match this condition, e.g. `t.where('status', "= 'paid'")`. */
  filter?: string;
  /**
   * How `filter` is written:
   * - `'case'` (default): `MAX(CASE WHEN filter THEN expression END)`, in every database;
   * - `'filter'`: `MAX(expression) FILTER (WHERE filter)`, PostgreSQL and SQLite 3.30+ only.
   */
  syntax?: 'case' | 'filter';
};

// a type name, with an optional size and array brackets: `numeric`, `numeric(10, 2)`, `uuid[]`, `double precision`
const SQL_TYPE = /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z_][A-Za-z0-9_]*)*(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(?:\[\])*$/;

function expression(method: string, value: unknown, position = 'argument'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Sql.${method}(): the ${position} is an SQL expression, got ${JSON.stringify(value) ?? String(value)}`);
  }

  return value;
}

function expressions(method: string, values: readonly unknown[], least: number): string {
  if (values.length < least) {
    throw new TypeError(`Sql.${method}() needs at least ${least} expressions, got ${values.length}`);
  }

  return values.map((value, index) => expression(method, value, `argument ${index + 1}`)).join(', ');
}

function aggregate(name: string, method: string, value: string, aggregateOptions: SqlAggregateOptions = {}): string {
  if (typeof aggregateOptions !== 'object' || aggregateOptions === null) {
    throw new TypeError(`Sql.${method}(): the second argument is an options object, e.g. { filter: "…" }`);
  }

  const { distinct = false, filter, syntax } = aggregateOptions;
  const { argument, suffix } = filtered(`Sql.${method}`, value, filter, syntax);

  return `${name}(${distinct ? 'DISTINCT ' : ''}${argument})${suffix}`;
}

/**
 * SQL functions and keywords as helpers, written as they are: `Sql.max(t.createdAt)` is `MAX("t"."createdAt")`.
 * They take SQL expressions, such as the columns of a `tableHelper` (`t.createdAt`) or other helpers, and check
 * only that each is given. Unlike `tableHelper`'s `count` and `sum`, `Sql.count` and `Sql.sum` neither cast nor
 * replace NULL: the result is the function's own.
 */
export const Sql = {
  /**
   * `COUNT(expression)`, `COUNT(*)` without one. The `pg` driver returns it as a string: `tableHelper.count()` casts
   * it to an integer.
   */
  count(value?: string, aggregateOptions: SqlAggregateOptions = {}): string {
    if (value === undefined) {
      if (aggregateOptions.distinct) {
        throw new TypeError('Sql.count({ distinct: true }) needs an expression, e.g. Sql.count(t.email, { distinct: true })');
      }

      // a CASE can't return `*`: without an expression, it counts 1 per matching row
      const counted = aggregateOptions.filter && (aggregateOptions.syntax ?? 'case') === 'case' ? '1' : '*';

      return aggregate('COUNT', 'count', counted, aggregateOptions);
    }

    return aggregate('COUNT', 'count', expression('count', value), aggregateOptions);
  },
  /** `SUM(expression)`: NULL for no rows, where `tableHelper.sum()` gives 0. */
  sum(value: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('SUM', 'sum', expression('sum', value), aggregateOptions);
  },
  /** `MIN(expression)`: NULL for no rows. */
  min(value: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('MIN', 'min', expression('min', value), aggregateOptions);
  },
  /** `MAX(expression)`: NULL for no rows. */
  max(value: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('MAX', 'max', expression('max', value), aggregateOptions);
  },
  /** `AVG(expression)`: NULL for no rows; the `pg` driver returns PostgreSQL's `numeric` as a string. */
  avg(value: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('AVG', 'avg', expression('avg', value), aggregateOptions);
  },
  /** `BOOL_OR(condition)`: true when the condition holds for some row. PostgreSQL. */
  boolOr(condition: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('BOOL_OR', 'boolOr', expression('boolOr', condition), aggregateOptions);
  },
  /** `BOOL_AND(condition)`: true when the condition holds for every row. PostgreSQL. */
  boolAnd(condition: string, aggregateOptions?: SqlAggregateOptions): string {
    return aggregate('BOOL_AND', 'boolAnd', expression('boolAnd', condition), aggregateOptions);
  },
  /** `COALESCE(a, b, …)`: the first argument that isn't NULL. */
  coalesce(...values: [string, string, ...string[]]): string {
    return `COALESCE(${expressions('coalesce', values, 2)})`;
  },
  /** `NULLIF(a, b)`: NULL when `a` equals `b`, else `a`: `Sql.nullif(t.name, "''")`. */
  nullif(value: string, nullValue: string): string {
    return `NULLIF(${expression('nullif', value, 'first argument')}, ${expression('nullif', nullValue, 'second argument')})`;
  },
  /**
   * `GREATEST(a, b, …)`. PostgreSQL skips NULL arguments, MySQL returns NULL for any; SQLite has no `GREATEST`
   * (its `MAX(a, b)` returns NULL for any NULL).
   */
  greatest(...values: [string, string, ...string[]]): string {
    return `GREATEST(${expressions('greatest', values, 2)})`;
  },
  /** `LEAST(a, b, …)`, NULL arguments as in `greatest`. */
  least(...values: [string, string, ...string[]]): string {
    return `LEAST(${expressions('least', values, 2)})`;
  },
  /** `LOWER(expression)`. */
  lower(value: string): string {
    return `LOWER(${expression('lower', value)})`;
  },
  /** `UPPER(expression)`. */
  upper(value: string): string {
    return `UPPER(${expression('upper', value)})`;
  },
  /** `CAST(expression AS type)`; the type is a name with an optional size and `[]`: `'numeric(10, 2)'`, `'uuid[]'`. */
  cast(value: string, type: string): string {
    if (typeof type !== 'string' || !SQL_TYPE.test(type.trim())) {
      throw new TypeError(`Sql.cast(): "${String(type)}" is not a type name, e.g. 'numeric', 'numeric(10, 2)', 'uuid[]'`);
    }

    return `CAST(${expression('cast', value)} AS ${type.trim()})`;
  },
  /** `DISTINCT ON (a, b, …)`, for a SELECT written as SQL; a query builder has `distinctOnTyped`. PostgreSQL. */
  distinctOn(...values: [string, ...string[]]): string {
    return `DISTINCT ON (${expressions('distinctOn', values, 1)})`;
  },
};
