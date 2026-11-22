import type { DatabaseType } from 'typeorm';
import { isMysqlLikeDriver, isPostgresLikeDriver, isSqliteLikeDriver } from './sql.utils';
import { filtered, sqlString } from './aggregate.utils';
import { DATE_TRUNC_UNITS, toPostgresZone } from './time-zone.utils';
import type { DateTruncUnit } from './time-zone.utils';

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

export type SqlValueAggregateOptions = SqlAggregateOptions & {
  /**
   * The value of the rows `filter` leaves out: `SUM(CASE WHEN filter THEN expression ELSE value END)`. Always a
   * `CASE`, whatever the `syntax`, since `FILTER (WHERE …)` has no else. Needs `filter`.
   */
  else?: SqlValue;
};

/** A branch of `Sql.case`: `WHEN condition THEN value`. */
export type SqlCaseBranch = { when: string; then: SqlValue };

/** A branch of `Sql.caseOf`: `WHEN match THEN value`, taken when the compared value equals `match`. */
export type SqlCaseOfBranch = { when: SqlValue; then: SqlValue };

export type SqlCaseOptions = {
  /** `ELSE value`: the value when no branch is taken, NULL without it. */
  else?: SqlValue;
};

export type SqlStringAggOptions = SqlAggregateOptions & {
  /** Orders the values: one expression or several, each with `ASC` / `DESC` if needed. On SQLite, 3.44+. */
  orderBy?: string | readonly string[];
};

export type SqlArrayAggOptions = {
  /** Each value once. PostgreSQL then orders only by the aggregated expression. */
  distinct?: boolean;
  /** Orders the values: one expression or several, each with `ASC` / `DESC` if needed. On SQLite, 3.44+. */
  orderBy?: string | readonly string[];
  /**
   * Aggregates only the rows that match, as `FILTER (WHERE …)`: a CASE would leave a NULL in the array for each
   * skipped row. PostgreSQL and SQLite 3.30+.
   */
  filter?: string;
};

/**
 * A time zone: a name or an ISO 8601 offset (`'Europe/Kyiv'`, `'+02:00'` = UTC+2), written as an escaped string;
 * or an SQL expression, `{ sql: e.timezone }`.
 */
export type SqlTimeZone = string | { sql: string };

/** An SQL expression, or a number written as a literal: `Sql.coalesce(Sql.sum(t.total), 0)` is `COALESCE(SUM("t"."total"), 0)`. */
export type SqlValue = string | number;

/** A key of a JSON object, or the index of an array item from 0. */
export type SqlJsonKey = string | number;

export type SqlWindow = {
  /** `PARTITION BY`: one expression or several. */
  partitionBy?: string | readonly string[];
  /** `ORDER BY`: one expression or several, each with `ASC` / `DESC` if needed. */
  orderBy?: string | readonly string[];
  /** The frame, written after `ORDER BY`: `'ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING'`. */
  frame?: string;
};

export type SqlIntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

/** An integer number of units, or an SQL expression, `{ sql: ':days' }`. */
export type SqlIntervalAmount = number | { sql: string };

export type SqlOptions = {
  /** How the aggregates write `filter` when a call doesn't set its `syntax`: `'case'` (default) or `'filter'`. */
  syntax?: 'case' | 'filter';
};

export type SqlDatePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'epoch' | 'dow';

type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'other';

const MYSQL_UNITS: Record<SqlIntervalUnit, string> = {
  seconds: 'SECOND',
  minutes: 'MINUTE',
  hours: 'HOUR',
  days: 'DAY',
  weeks: 'WEEK',
  months: 'MONTH',
  years: 'YEAR',
};

const MAKE_INTERVAL_ARGS: Record<SqlIntervalUnit, string> = {
  seconds: 'secs',
  minutes: 'mins',
  hours: 'hours',
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years',
};

const SQLITE_PARTS: Record<Exclude<SqlDatePart, 'epoch'>, string> = {
  year: '%Y',
  month: '%m',
  day: '%d',
  hour: '%H',
  minute: '%M',
  second: '%S',
  dow: '%w',
};

// a type name, with an optional size and array brackets: `numeric`, `numeric(10, 2)`, `uuid[]`, `double precision`
const SQL_TYPE = /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z_][A-Za-z0-9_]*)*(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(?:\[\])*$/;

const toDialect = (driver?: DatabaseType): Dialect => {
  if (driver === undefined || isPostgresLikeDriver(driver)) {
    return 'postgres';
  }

  if (isMysqlLikeDriver(driver)) {
    return 'mysql';
  }

  return isSqliteLikeDriver(driver) ? 'sqlite' : 'other';
};

function expression(method: string, value: unknown, position = 'argument'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Sql.${method}(): the ${position} is an SQL expression, got ${JSON.stringify(value) ?? String(value)}`);
  }

  return value;
}

function operand(method: string, input: unknown, position = 'argument'): string {
  if (typeof input !== 'number') {
    return expression(method, input, position);
  }

  if (!Number.isFinite(input)) {
    throw new TypeError(`Sql.${method}(): the ${position} is an SQL expression or a finite number, got ${String(input)}`);
  }

  return String(input);
}

function caseBranches(method: string, branches: unknown, when: typeof expression, options: unknown): string {
  if (!Array.isArray(branches) || !branches.length) {
    throw new TypeError(`Sql.${method}() needs at least one { when, then } branch`);
  }

  if (typeof options !== 'object' || options === null) {
    throw new TypeError(`Sql.${method}(): the last argument is an options object, e.g. { else: 0 }`);
  }

  const whens = branches.map((branch: unknown, index) => {
    if (typeof branch !== 'object' || branch === null || Array.isArray(branch) || !('when' in branch) || !('then' in branch)) {
      throw new TypeError(`Sql.${method}(): branch ${index + 1} is a { when, then } object`);
    }

    return `WHEN ${when(method, branch.when, `when ${index + 1}`)} THEN ${operand(method, branch.then, `then ${index + 1}`)}`;
  });
  const otherwise = (options as SqlCaseOptions).else;

  return `${whens.join(' ')}${otherwise === undefined ? '' : ` ELSE ${operand(method, otherwise, 'else value')}`}`;
}

function expressions(method: string, values: readonly unknown[], least: number, item = expression): string[] {
  if (values.length < least) {
    throw new TypeError(`Sql.${method}() needs at least ${least} expressions, got ${values.length}`);
  }

  return values.map((input, index) => item(method, input, `argument ${index + 1}`));
}

function integer(method: string, value: unknown, position: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`Sql.${method}(): the ${position} is an integer, got ${String(value)}`);
  }

  return value;
}

function intervalAmount(method: string, amount: unknown): number | string {
  if (typeof amount === 'object' && amount !== null) {
    return expression(method, (amount as { sql?: unknown }).sql, 'amount');
  }

  return integer(method, amount, 'amount');
}

function intervalUnit(method: string, unit: unknown): SqlIntervalUnit {
  if (typeof unit !== 'string' || !(unit in MYSQL_UNITS)) {
    throw new TypeError(`Sql.${method}(): the unit is one of ${Object.keys(MYSQL_UNITS).join(', ')}, got "${String(unit)}"`);
  }

  return unit as SqlIntervalUnit;
}

const list = (method: string, values: string | readonly string[], position: string): string =>
  (typeof values === 'string' ? [values] : values).map((value) => expression(method, value, position)).join(', ');

/**
 * SQL functions and keywords as helpers, for one database: see `Sql`. `Sql.for('mysql')` writes MySQL / MariaDB,
 * `Sql.for('sqlite')` (`'better-sqlite3'`, …) SQLite; `Sql` itself writes PostgreSQL where the databases differ.
 */
function createFunctions(driver?: DatabaseType, sqlOptions: SqlOptions = {}) {
  const dialect = toDialect(driver);
  const name = driver ?? 'postgres';
  const defaultSyntax = sqlOptions.syntax ?? 'case';

  if (defaultSyntax !== 'case' && defaultSyntax !== 'filter') {
    throw new TypeError(`Sql.for(): syntax is 'case' or 'filter', got "${String(defaultSyntax)}"`);
  }

  const only = (method: string, ...dialects: Dialect[]): void => {
    if (!dialects.includes(dialect)) {
      throw new TypeError(`Sql.${method}() has no equivalent on ${name}`);
    }
  };

  const aggregate = (fn: string, method: string, value: string, aggregateOptions: SqlValueAggregateOptions = {}): string => {
    if (typeof aggregateOptions !== 'object' || aggregateOptions === null) {
      throw new TypeError(`Sql.${method}(): the second argument is an options object, e.g. { filter: "…" }`);
    }

    const { distinct = false, filter, syntax = defaultSyntax, else: otherwise } = aggregateOptions;

    if (otherwise !== undefined) {
      if (!filter) {
        throw new TypeError(`Sql.${method}(): else needs a filter, e.g. { filter: "…", else: 0 }`);
      }

      return `${fn}(${distinct ? 'DISTINCT ' : ''}CASE WHEN ${filter} THEN ${value} ELSE ${operand(method, otherwise, 'else value')} END)`;
    }

    const { argument, suffix } = filtered(`Sql.${method}`, value, filter, syntax, driver);

    return `${fn}(${distinct ? 'DISTINCT ' : ''}${argument})${suffix}`;
  };

  const intervalSql = (size: number | string, unit: SqlIntervalUnit): string => {
    if (dialect === 'mysql') {
      return `INTERVAL ${typeof size === 'number' ? size : `(${size})`} ${MYSQL_UNITS[unit]}`;
    }

    return typeof size === 'number' ? `INTERVAL '${size} ${unit}'` : `make_interval(${MAKE_INTERVAL_ARGS[unit]} => ${size})`;
  };

  // the SQL that moves `value` by `size` units of time, back with `back`: a negative number moves it the other way
  const shift = (method: string, value: string, size: number | string, unit: SqlIntervalUnit, back: boolean): string => {
    const amount = typeof size === 'number' ? Math.abs(size) : size;
    const sign = (typeof size === 'number' && size < 0) !== back ? '-' : '+';

    if (dialect === 'sqlite') {
      // SQLite's modifiers have no weeks
      const weeks = unit === 'weeks';
      const sqliteUnit = weeks ? 'days' : unit;

      if (typeof amount === 'number') {
        return `datetime(${value}, '${sign}${weeks ? amount * 7 : amount} ${sqliteUnit}')`;
      }

      return `datetime(${value}, '${sign}' || ${weeks ? `(${amount}) * 7` : `(${amount})`} || ' ${sqliteUnit}')`;
    }

    only(method, 'postgres', 'mysql');

    return `(${value} ${sign} ${intervalSql(amount, unit)})`;
  };

  // ARRAY_AGG and the JSON arrays: FILTER, since a CASE would add a NULL item for each skipped row
  const collect = (fn: string, method: string, value: string, aggOptions: SqlArrayAggOptions = {}): string => {
    if (typeof aggOptions !== 'object' || aggOptions === null) {
      throw new TypeError(`Sql.${method}(): the second argument is an options object, e.g. { orderBy: "…" }`);
    }

    const { distinct = false, orderBy, filter } = aggOptions;
    const order = orderBy === undefined ? '' : ` ORDER BY ${list(method, orderBy, 'orderBy')}`;
    const where = filter === undefined ? '' : ` FILTER (WHERE ${expression(method, filter, 'filter')})`;

    return `${fn}(${distinct ? 'DISTINCT ' : ''}${expression(method, value)}${order})${where}`;
  };

  const jsonObject = (method: string, fn: string, fields: Readonly<Record<string, SqlValue>>): string => {
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
      throw new TypeError(`Sql.${method}() takes an object of keys and SQL expressions, e.g. { id: t.id }`);
    }

    const entries = Object.entries(fields);

    if (!entries.length) {
      throw new TypeError(`Sql.${method}() needs at least one key`);
    }

    const pairs = entries.map(([key, value]) => `${sqlString(key, driver)}, ${operand(method, value, `value of "${key}"`)}`);

    return `${fn}(${pairs.join(', ')})`;
  };

  // `->` / `->>` key by key on PostgreSQL; a `$."a"[0]` path on MySQL (JSON_EXTRACT) and SQLite 3.38+ (`->`, `->>`)
  const jsonAccess = (method: string, value: string, path: readonly SqlJsonKey[], asText: boolean): string => {
    only(method, 'postgres', 'mysql', 'sqlite');

    const target = expression(method, value);

    if (!Array.isArray(path) || !path.length) {
      throw new TypeError(`Sql.${method}() needs at least one key`);
    }

    for (const key of path) {
      if (typeof key === 'number' ? !Number.isInteger(key) || key < 0 : typeof key !== 'string') {
        throw new TypeError(`Sql.${method}(): a key is a string or an array index from 0, got ${String(key)}`);
      }
    }

    if (dialect === 'postgres') {
      const steps = path.map(
        (key, index) => `${asText && index === path.length - 1 ? '->>' : '->'} ${typeof key === 'number' ? key : sqlString(key)}`
      );

      return `(${target} ${steps.join(' ')})`;
    }

    const jsonPath = path
      .map((key) => {
        if (typeof key === 'number') {
          return `[${key}]`;
        }

        // a quoted key of a JSON path ends at the next quote on SQLite
        if (/["\\]/.test(key)) {
          throw new TypeError(`Sql.${method}(): a key of a ${name} JSON path has no " or \\, got ${JSON.stringify(key)}`);
        }

        return `."${key}"`;
      })
      .join('');
    const literal = sqlString(`$${jsonPath}`, driver);

    if (dialect === 'sqlite') {
      return `(${target} ${asText ? '->>' : '->'} ${literal})`;
    }

    const extracted = `JSON_EXTRACT(${target}, ${literal})`;

    return asText ? `JSON_UNQUOTE(${extracted})` : extracted;
  };

  const timeZone = (method: string, zone: SqlTimeZone): string => {
    if (typeof zone === 'string') {
      if (!zone.trim()) {
        throw new TypeError(`Sql.${method}(): the time zone is empty`);
      }

      return sqlString(toPostgresZone(`Sql.${method}`, zone));
    }

    if (typeof zone !== 'object' || zone === null) {
      throw new TypeError(`Sql.${method}(): the time zone is a name, an offset or { sql: … }, got ${String(zone)}`);
    }

    return expression(method, zone.sql, 'time zone');
  };

  const now = (): string => (dialect === 'postgres' || dialect === 'mysql' ? 'NOW()' : 'CURRENT_TIMESTAMP');

  return {
    /**
     * `COUNT(expression)`, `COUNT(*)` without one. The `pg` driver returns it as a string: `tableHelper.count()` casts
     * it to an integer.
     */
    count(value?: SqlValue | SqlAggregateOptions, aggregateOptions: SqlAggregateOptions = {}): string {
      const [counted, options] = typeof value === 'object' && value !== null ? [undefined, value] : [value, aggregateOptions];

      if ((options as SqlValueAggregateOptions | undefined)?.else !== undefined) {
        throw new TypeError('Sql.count() has no else: COUNT counts every value that is not NULL, the else value too');
      }

      if (counted === undefined) {
        if (options.distinct) {
          throw new TypeError('Sql.count({ distinct: true }) needs an expression, e.g. Sql.count(t.email, { distinct: true })');
        }

        // a CASE can't return `*`: without an expression, it counts 1 per matching row
        const star = options.filter && (options.syntax ?? defaultSyntax) === 'case' ? '1' : '*';

        return aggregate('COUNT', 'count', star, options);
      }

      return aggregate('COUNT', 'count', operand('count', counted), options);
    },
    /** `SUM(expression)`: NULL for no rows, where `tableHelper.sum()` gives 0. */
    sum(value: SqlValue, aggregateOptions?: SqlValueAggregateOptions): string {
      return aggregate('SUM', 'sum', operand('sum', value), aggregateOptions);
    },
    /** `MIN(expression)`: NULL for no rows. */
    min(value: SqlValue, aggregateOptions?: SqlValueAggregateOptions): string {
      return aggregate('MIN', 'min', operand('min', value), aggregateOptions);
    },
    /** `MAX(expression)`: NULL for no rows. */
    max(value: SqlValue, aggregateOptions?: SqlValueAggregateOptions): string {
      return aggregate('MAX', 'max', operand('max', value), aggregateOptions);
    },
    /** `AVG(expression)`: NULL for no rows; the `pg` driver returns PostgreSQL's `numeric` as a string. */
    avg(value: SqlValue, aggregateOptions?: SqlValueAggregateOptions): string {
      return aggregate('AVG', 'avg', operand('avg', value), aggregateOptions);
    },
    /** `BOOL_OR(condition)`: true when the condition holds for some row. PostgreSQL. */
    boolOr(condition: string, aggregateOptions?: SqlAggregateOptions): string {
      only('boolOr', 'postgres');
      return aggregate('BOOL_OR', 'boolOr', expression('boolOr', condition), aggregateOptions);
    },
    /** `BOOL_AND(condition)`: true when the condition holds for every row. PostgreSQL. */
    boolAnd(condition: string, aggregateOptions?: SqlAggregateOptions): string {
      only('boolAnd', 'postgres');
      return aggregate('BOOL_AND', 'boolAnd', expression('boolAnd', condition), aggregateOptions);
    },
    /**
     * The values of a group joined into one string, NULL for no rows: `STRING_AGG(expression, ', ')` on PostgreSQL
     * (a text expression), `GROUP_CONCAT(…)` on MySQL and SQLite, where `distinct` can't go with a separator.
     */
    stringAgg(value: string, separator: string, aggregateOptions: SqlStringAggOptions = {}): string {
      only('stringAgg', 'postgres', 'mysql', 'sqlite');

      if (typeof separator !== 'string') {
        throw new TypeError(`Sql.stringAgg(): the separator is a string, got ${String(separator)}`);
      }

      const { distinct = false, orderBy, filter, syntax = defaultSyntax } = aggregateOptions;
      const { argument, suffix } = filtered('Sql.stringAgg', expression('stringAgg', value), filter, syntax, driver);
      const order = orderBy === undefined ? '' : ` ORDER BY ${list('stringAgg', orderBy, 'orderBy')}`;
      const each = distinct ? 'DISTINCT ' : '';
      const literal = sqlString(separator, driver);

      if (dialect === 'mysql') {
        return `GROUP_CONCAT(${each}${argument}${order} SEPARATOR ${literal})${suffix}`;
      }

      if (dialect === 'sqlite') {
        if (distinct) {
          throw new TypeError('Sql.stringAgg(): SQLite takes no separator with distinct, aggregate distinct values in a subquery');
        }

        return `GROUP_CONCAT(${argument}, ${literal}${order})${suffix}`;
      }

      return `STRING_AGG(${each}${argument}, ${literal}${order})${suffix}`;
    },
    /** `ARRAY_AGG(expression)`: the values of a group as an array, NULL for no rows. PostgreSQL. */
    arrayAgg(value: string, aggOptions?: SqlArrayAggOptions): string {
      only('arrayAgg', 'postgres');
      return collect('ARRAY_AGG', 'arrayAgg', value, aggOptions);
    },
    /**
     * The values of a group as a JSON array, NULL for no rows: `json_agg(…)`, `json_group_array(…)` on SQLite and
     * `JSON_ARRAYAGG(…)` on MySQL, which takes no options.
     */
    jsonAgg(value: string, aggOptions: SqlArrayAggOptions = {}): string {
      only('jsonAgg', 'postgres', 'mysql', 'sqlite');

      if (dialect !== 'mysql') {
        return collect(dialect === 'sqlite' ? 'json_group_array' : 'json_agg', 'jsonAgg', value, aggOptions);
      }

      if (aggOptions.distinct || aggOptions.orderBy !== undefined || aggOptions.filter !== undefined) {
        throw new TypeError("Sql.jsonAgg(): MySQL's JSON_ARRAYAGG takes no distinct, orderBy or filter");
      }

      return `JSON_ARRAYAGG(${expression('jsonAgg', value)})`;
    },
    /** `jsonb_agg(expression)`: the values of a group as a JSONB array, NULL for no rows. PostgreSQL. */
    jsonbAgg(value: string, aggOptions?: SqlArrayAggOptions): string {
      only('jsonbAgg', 'postgres');
      return collect('jsonb_agg', 'jsonbAgg', value, aggOptions);
    },
    /**
     * `PERCENTILE_CONT(fraction) WITHIN GROUP (ORDER BY expression)`: the value at a fraction of the ordered values,
     * interpolated between rows; 0.5 is the median. NULL for no rows. PostgreSQL.
     */
    percentileCont(fraction: SqlValue, orderBy: string | readonly string[]): string {
      only('percentileCont', 'postgres');
      return `PERCENTILE_CONT(${operand('percentileCont', fraction, 'fraction')}) WITHIN GROUP (ORDER BY ${list('percentileCont', orderBy, 'orderBy')})`;
    },
    /** `PERCENTILE_DISC(fraction) WITHIN GROUP (ORDER BY expression)`: `percentileCont` that returns a value of a row. PostgreSQL. */
    percentileDisc(fraction: SqlValue, orderBy: string | readonly string[]): string {
      only('percentileDisc', 'postgres');
      return `PERCENTILE_DISC(${operand('percentileDisc', fraction, 'fraction')}) WITHIN GROUP (ORDER BY ${list('percentileDisc', orderBy, 'orderBy')})`;
    },
    /** `MODE() WITHIN GROUP (ORDER BY expression)`: the most frequent value. NULL for no rows. PostgreSQL. */
    mode(value: string): string {
      only('mode', 'postgres');
      return `MODE() WITHIN GROUP (ORDER BY ${expression('mode', value)})`;
    },

    /** `COALESCE(a, b, …)`: the first argument that isn't NULL. */
    coalesce(...values: [SqlValue, SqlValue, ...SqlValue[]]): string {
      return `COALESCE(${expressions('coalesce', values, 2, operand).join(', ')})`;
    },
    /** `NULLIF(a, b)`: NULL when `a` equals `b`, else `a`: `Sql.nullif(t.name, "''")`. */
    nullif(value: SqlValue, nullValue: SqlValue): string {
      return `NULLIF(${operand('nullif', value, 'first argument')}, ${operand('nullif', nullValue, 'second argument')})`;
    },
    /**
     * `GREATEST(a, b, …)`. PostgreSQL skips NULL arguments, MySQL returns NULL for any; on SQLite it is `MAX(a, b, …)`,
     * NULL for any NULL argument.
     */
    greatest(...values: [SqlValue, SqlValue, ...SqlValue[]]): string {
      return `${dialect === 'sqlite' ? 'MAX' : 'GREATEST'}(${expressions('greatest', values, 2, operand).join(', ')})`;
    },
    /** `LEAST(a, b, …)`, `MIN(a, b, …)` on SQLite; NULL arguments as in `greatest`. */
    least(...values: [SqlValue, SqlValue, ...SqlValue[]]): string {
      return `${dialect === 'sqlite' ? 'MIN' : 'LEAST'}(${expressions('least', values, 2, operand).join(', ')})`;
    },
    /** `CASE WHEN condition THEN value … [ELSE value] END`: the value of the first condition that holds. */
    case(branches: readonly SqlCaseBranch[], options: SqlCaseOptions = {}): string {
      return `CASE ${caseBranches('case', branches, expression, options)} END`;
    },
    /** `CASE value WHEN match THEN result … [ELSE result] END`: the result of the first match equal to the value. */
    caseOf(value: SqlValue, branches: readonly SqlCaseOfBranch[], options: SqlCaseOptions = {}): string {
      return `CASE ${operand('caseOf', value)} ${caseBranches('caseOf', branches, operand, options)} END`;
    },

    /** `LOWER(expression)`. */
    lower(value: string): string {
      return `LOWER(${expression('lower', value)})`;
    },
    /** `UPPER(expression)`. */
    upper(value: string): string {
      return `UPPER(${expression('upper', value)})`;
    },
    /** `TRIM(expression)`: without the spaces at both ends. */
    trim(value: string): string {
      return `TRIM(${expression('trim', value)})`;
    },
    /** The length in characters: `LENGTH(…)`, `CHAR_LENGTH(…)` on MySQL, whose `LENGTH` counts bytes. */
    length(value: string): string {
      return `${dialect === 'mysql' ? 'CHAR_LENGTH' : 'LENGTH'}(${expression('length', value)})`;
    },
    /**
     * The strings joined, a NULL one read as empty, like PostgreSQL's `CONCAT(a, b)`: `CONCAT_WS('', a, b)` on MySQL,
     * whose `CONCAT` gives NULL for any NULL, and `COALESCE(a, '') || COALESCE(b, '')` on SQLite.
     */
    concat(...values: [SqlValue, SqlValue, ...SqlValue[]]): string {
      const parts = expressions('concat', values, 2, operand);
      const joined = parts.join(', ');

      if (dialect === 'mysql') {
        return `CONCAT_WS('', ${joined})`;
      }

      if (dialect === 'sqlite') {
        return `(${parts.map((part) => `COALESCE(${part}, '')`).join(' || ')})`;
      }

      return `CONCAT(${joined})`;
    },
    /** `SUBSTRING(expression, start[, length])`, `SUBSTR` on SQLite; positions from 1, numbers or SQL expressions. */
    substring(value: string, start: number | string, length?: number | string): string {
      const position = (part: number | string, label: string) =>
        typeof part === 'number' ? String(integer('substring', part, label)) : expression('substring', part, label);
      const args = [expression('substring', value), position(start, 'start'), ...(length === undefined ? [] : [position(length, 'length')])];

      return `${dialect === 'sqlite' ? 'SUBSTR' : 'SUBSTRING'}(${args.join(', ')})`;
    },
    /** `SPLIT_PART(expression, 'delimiter', n)`: the n-th part, from 1; an empty string past the last. PostgreSQL. */
    splitPart(value: string, delimiter: string, part: number): string {
      only('splitPart', 'postgres');
      return `SPLIT_PART(${expression('splitPart', value)}, ${sqlString(String(delimiter), driver)}, ${integer('splitPart', part, 'part')})`;
    },
    /** `CAST(expression AS type)`; the type is a name with an optional size and `[]`: `'numeric(10, 2)'`, `'uuid[]'`. */
    cast(value: SqlValue, type: string): string {
      if (typeof type !== 'string' || !SQL_TYPE.test(type.trim())) {
        throw new TypeError(`Sql.cast(): "${String(type)}" is not a type name, e.g. 'numeric', 'numeric(10, 2)', 'uuid[]'`);
      }

      return `CAST(${operand('cast', value)} AS ${type.trim()})`;
    },

    /**
     * `ROUND(expression[, digits])`, digits after the point, before it when negative (SQLite takes a negative
     * as 0). PostgreSQL rounds to digits only a `numeric`: `Sql.round(Sql.cast(x, 'numeric'), 2)`.
     */
    round(value: SqlValue, digits?: number): string {
      const places = digits === undefined ? '' : `, ${integer('round', digits, 'digits')}`;

      return `ROUND(${operand('round', value)}${places})`;
    },
    /** `ABS(expression)`. */
    abs(value: SqlValue): string {
      return `ABS(${operand('abs', value)})`;
    },
    /** `FLOOR(expression)`; SQLite 3.35+ built with its math functions. */
    floor(value: SqlValue): string {
      return `FLOOR(${operand('floor', value)})`;
    },
    /** `CEIL(expression)`; SQLite 3.35+ built with its math functions. */
    ceil(value: SqlValue): string {
      return `CEIL(${operand('ceil', value)})`;
    },

    /** The time the transaction (PostgreSQL) or the statement started: `NOW()`, `CURRENT_TIMESTAMP` on SQLite. */
    now,
    /**
     * An interval to add to a time or subtract from it: `INTERVAL '30 days'`, `INTERVAL 30 DAY` on MySQL. SQLite has
     * no intervals: use `addInterval` or `ago`.
     */
    interval(amount: SqlIntervalAmount, unit: SqlIntervalUnit): string {
      only('interval', 'postgres', 'mysql');

      const size = intervalAmount('interval', amount);

      return intervalSql(size, intervalUnit('interval', unit));
    },
    /**
     * The time `amount` units after `expression`, before it for a negative amount: `("t"."paidAt" + INTERVAL '30 days')`;
     * `datetime(…, '+30 days')` on SQLite, which gives text.
     */
    addInterval(value: string, amount: SqlIntervalAmount, unit: SqlIntervalUnit): string {
      return shift('addInterval', expression('addInterval', value), intervalAmount('addInterval', amount), intervalUnit('addInterval', unit), false);
    },
    /** The time `amount` units ago: `(NOW() - INTERVAL '30 days')`, `datetime('now', '-30 days')` on SQLite. */
    ago(amount: SqlIntervalAmount, unit: SqlIntervalUnit): string {
      const size = intervalAmount('ago', amount);
      const checked = intervalUnit('ago', unit);

      return shift('ago', dialect === 'sqlite' ? `'now'` : now(), size, checked, true);
    },
    /**
     * A part of a time as a number: `EXTRACT(YEAR FROM …)`. `'epoch'` is the seconds since 1970 (`UNIX_TIMESTAMP` on
     * MySQL), `'dow'` the day of the week from 0, Sunday. PostgreSQL returns `numeric`, a string from the `pg` driver;
     * SQLite reads it with `strftime`.
     */
    extract(part: SqlDatePart, value: string): string {
      const time = expression('extract', value);

      if (typeof part !== 'string' || !(part in SQLITE_PARTS || part === 'epoch')) {
        throw new TypeError(`Sql.extract(): the part is one of ${[...Object.keys(SQLITE_PARTS), 'epoch'].join(', ')}, got "${String(part)}"`);
      }

      if (dialect === 'sqlite') {
        return `CAST(strftime('${part === 'epoch' ? '%s' : SQLITE_PARTS[part]}', ${time}) AS integer)`;
      }

      only('extract', 'postgres', 'mysql');

      if (dialect === 'mysql' && part === 'epoch') {
        return `UNIX_TIMESTAMP(${time})`;
      }

      if (dialect === 'mysql' && part === 'dow') {
        return `(DAYOFWEEK(${time}) - 1)`;
      }

      return `EXTRACT(${part.toUpperCase()} FROM ${time})`;
    },
    /** `TO_CHAR(expression, 'format')`, PostgreSQL's format patterns (`'YYYY-MM-DD'`). PostgreSQL. */
    toChar(value: string, format: string): string {
      only('toChar', 'postgres');
      return `TO_CHAR(${expression('toChar', value)}, ${sqlString(expression('toChar', format, 'format'))})`;
    },
    /**
     * `(expression AT TIME ZONE zone)`: a `timestamptz` as the wall clock of the zone, a `timestamp` read as that wall
     * clock. A zone name or offset is an escaped string; a column is `{ sql: e.timezone }`. PostgreSQL.
     */
    atTimeZone(value: string, zone: SqlTimeZone): string {
      only('atTimeZone', 'postgres');
      return `(${expression('atTimeZone', value)} AT TIME ZONE ${timeZone('atTimeZone', zone)})`;
    },
    /**
     * `DATE_TRUNC('day', expression)`: the time cut down to the unit. With a zone (PostgreSQL 12+) a `timestamptz` is
     * cut at that zone's boundaries, e.g. its local midnight. PostgreSQL.
     */
    dateTrunc(unit: DateTruncUnit, value: string, zone?: SqlTimeZone): string {
      only('dateTrunc', 'postgres');

      if (!DATE_TRUNC_UNITS.includes(unit)) {
        throw new TypeError(`Sql.dateTrunc(): the unit is one of ${DATE_TRUNC_UNITS.join(', ')}, got "${String(unit)}"`);
      }

      const zoneSql = zone === undefined ? '' : `, ${timeZone('dateTrunc', zone)}`;

      return `DATE_TRUNC('${unit}', ${expression('dateTrunc', value)}${zoneSql})`;
    },

    /** `ROW_NUMBER()`, for `over`. */
    rowNumber: (): string => 'ROW_NUMBER()',
    /** `RANK()`, for `over`: ties share a rank and leave a gap after them. */
    rank: (): string => 'RANK()',
    /** `DENSE_RANK()`, for `over`: ties share a rank, without a gap. */
    denseRank: (): string => 'DENSE_RANK()',
    /** `LAG(expression[, offset[, default]])`, for `over`: the value `offset` rows before, 1 by default. */
    lag(value: string, offset?: number, defaultValue?: SqlValue): string {
      return windowShift('LAG', 'lag', value, offset, defaultValue);
    },
    /** `LEAD(expression[, offset[, default]])`, for `over`: the value `offset` rows after, 1 by default. */
    lead(value: string, offset?: number, defaultValue?: SqlValue): string {
      return windowShift('LEAD', 'lead', value, offset, defaultValue);
    },
    /** `FIRST_VALUE(expression)`, for `over`: the value at the first row of the frame. */
    firstValue(value: string): string {
      return `FIRST_VALUE(${expression('firstValue', value)})`;
    },
    /**
     * `LAST_VALUE(expression)`, for `over`: the value at the last row of the frame. With `orderBy` the default frame
     * ends at the current row, so the last row of the partition needs `frame: 'ROWS BETWEEN UNBOUNDED PRECEDING AND
     * UNBOUNDED FOLLOWING'`.
     */
    lastValue(value: string): string {
      return `LAST_VALUE(${expression('lastValue', value)})`;
    },
    /**
     * A window function or aggregate over a window: `Sql.over(Sql.rowNumber(), { partitionBy: t.userId, orderBy:
     * `${t.createdAt} DESC` })` → `ROW_NUMBER() OVER (PARTITION BY "t"."userId" ORDER BY "t"."createdAt" DESC)`.
     * PostgreSQL, MySQL 8, SQLite 3.25+.
     */
    over(fn: string, window: SqlWindow = {}): string {
      const parts = [
        window.partitionBy === undefined ? '' : `PARTITION BY ${list('over', window.partitionBy, 'partitionBy')}`,
        window.orderBy === undefined ? '' : `ORDER BY ${list('over', window.orderBy, 'orderBy')}`,
        window.frame === undefined ? '' : expression('over', window.frame, 'frame'),
      ].filter(Boolean);

      return `${expression('over', fn, 'function')} OVER (${parts.join(' ')})`;
    },

    /** `DISTINCT ON (a, b, …)`, for a SELECT written as SQL; a query builder has `distinctOnTyped`. PostgreSQL. */
    distinctOn(...values: [string, ...string[]]): string {
      only('distinctOn', 'postgres');
      return `DISTINCT ON (${expressions('distinctOn', values, 1).join(', ')})`;
    },

    /**
     * The JSON value at a path, NULL where it has none: `(t.data -> 'a' -> 0)`. MySQL: `JSON_EXTRACT(t.data, '$."a"[0]')`;
     * SQLite 3.38+: `(t.data -> '$."a"[0]')`. Keys are escaped strings; on MySQL and SQLite they have no `"` or `\`.
     */
    json(value: string, ...path: [SqlJsonKey, ...SqlJsonKey[]]): string {
      return jsonAccess('json', value, path, false);
    },
    /**
     * The value at a path as text (as an SQL value on SQLite), NULL where it has none: `(t.data -> 'a' ->> 'b')`.
     * MySQL: `JSON_UNQUOTE(JSON_EXTRACT(…))`, which reads a JSON `null` as the string `'null'`.
     */
    jsonText(value: string, ...path: [SqlJsonKey, ...SqlJsonKey[]]): string {
      return jsonAccess('jsonText', value, path, true);
    },
    /**
     * A JSON object of SQL expressions: `Sql.jsonBuildObject({ id: t.id, name: u.name })` →
     * `json_build_object('id', "t"."id", 'name', "u"."name")`; `JSON_OBJECT(…)` on MySQL, `json_object(…)` on SQLite.
     */
    jsonBuildObject(fields: Readonly<Record<string, SqlValue>>): string {
      only('jsonBuildObject', 'postgres', 'mysql', 'sqlite');

      const fn = dialect === 'mysql' ? 'JSON_OBJECT' : dialect === 'sqlite' ? 'json_object' : 'json_build_object';

      return jsonObject('jsonBuildObject', fn, fields);
    },
    /** `jsonb_build_object(…)`: `jsonBuildObject` as JSONB. PostgreSQL. */
    jsonbBuildObject(fields: Readonly<Record<string, SqlValue>>): string {
      only('jsonbBuildObject', 'postgres');
      return jsonObject('jsonbBuildObject', 'jsonb_build_object', fields);
    },
    /**
     * `jsonb_set(target, ARRAY['a', 'b'], value)`: the JSONB with the value at the path replaced, or added unless
     * `createMissing` is false. The value is JSONB SQL (`to_jsonb(:name)`, `'"x"'::jsonb`). PostgreSQL.
     */
    jsonbSet(target: string, path: readonly [string, ...string[]], value: string, jsonbOptions: { createMissing?: boolean } = {}): string {
      only('jsonbSet', 'postgres');

      if (!Array.isArray(path) || !path.length || path.some((key) => typeof key !== 'string')) {
        throw new TypeError('Sql.jsonbSet(): the path is a non-empty array of keys');
      }

      const keys = `ARRAY[${path.map((key) => sqlString(key)).join(', ')}]`;
      const create = jsonbOptions.createMissing === false ? ', false' : '';

      return `jsonb_set(${expression('jsonbSet', target, 'target')}, ${keys}, ${expression('jsonbSet', value, 'value')}${create})`;
    },
    /**
     * `(COALESCE(target, CAST('{}' AS jsonb)) || patch)`: the JSONB object with the keys of `patch` added or replaced,
     * a NULL target read as `{}`. The patch is JSONB SQL: `CAST(:patch AS jsonb)`, `Sql.jsonbBuildObject({ … })`. PostgreSQL.
     */
    jsonbMerge(target: string, patch: string): string {
      only('jsonbMerge', 'postgres');
      return `(COALESCE(${expression('jsonbMerge', target, 'target')}, CAST('{}' AS jsonb)) || ${expression('jsonbMerge', patch, 'patch')})`;
    },
    /** `to_jsonb(expression)`. PostgreSQL. */
    toJsonb(value: string): string {
      only('toJsonb', 'postgres');
      return `to_jsonb(${expression('toJsonb', value)})`;
    },
    /** `jsonb_typeof(expression)`: `'object'`, `'array'`, `'string'`, `'number'`, `'boolean'` or `'null'`. PostgreSQL. */
    jsonbTypeof(value: string): string {
      only('jsonbTypeof', 'postgres');
      return `jsonb_typeof(${expression('jsonbTypeof', value)})`;
    },
    /** `jsonb_array_elements(expression)`: a row per element, for FROM or a LATERAL join. PostgreSQL. */
    jsonbArrayElements(value: string): string {
      only('jsonbArrayElements', 'postgres');
      return `jsonb_array_elements(${expression('jsonbArrayElements', value)})`;
    },
    /** `array_position(array, value)`: the 1-based position of the first element equal to the value, NULL when there is none. PostgreSQL. */
    arrayPosition(array: string, value: SqlValue): string {
      only('arrayPosition', 'postgres');
      return `array_position(${expression('arrayPosition', array, 'array')}, ${operand('arrayPosition', value, 'value')})`;
    },
    /** `similarity(a, b)`: how alike two strings are by their trigrams, 0 to 1. PostgreSQL with the pg_trgm extension. */
    similarity(a: string, b: string): string {
      only('similarity', 'postgres');
      return `similarity(${expression('similarity', a, 'first argument')}, ${expression('similarity', b, 'second argument')})`;
    },
    /** `word_similarity(a, b)`: the best similarity of `a` to a run of words in `b`, 0 to 1. PostgreSQL with pg_trgm. */
    wordSimilarity(a: string, b: string): string {
      only('wordSimilarity', 'postgres');
      return `word_similarity(${expression('wordSimilarity', a, 'first argument')}, ${expression('wordSimilarity', b, 'second argument')})`;
    },
    /** `strict_word_similarity(a, b)`: `wordSimilarity` matched on whole words of `b`, 0 to 1. PostgreSQL with pg_trgm. */
    strictWordSimilarity(a: string, b: string): string {
      only('strictWordSimilarity', 'postgres');
      return `strict_word_similarity(${expression('strictWordSimilarity', a, 'first argument')}, ${expression('strictWordSimilarity', b, 'second argument')})`;
    },
  };
}

function windowShift(fn: string, method: string, value: string, offset?: number, defaultValue?: SqlValue): string {
  const args = [expression(method, value)];

  if (offset !== undefined || defaultValue !== undefined) {
    args.push(String(integer(method, offset ?? 1, 'offset')));
  }

  if (defaultValue !== undefined) {
    args.push(operand(method, defaultValue, 'default value'));
  }

  return `${fn}(${args.join(', ')})`;
}

/**
 * SQL functions and keywords as helpers, written as they are: `Sql.max(t.createdAt)` is `MAX("t"."createdAt")`.
 * They take SQL expressions, such as the columns of a `tableHelper` (`t.createdAt`) or other helpers, and check
 * only that each is given; where a value fits (`coalesce`, `nullif`, `case`, the aggregates, …) a number too.
 * Where the databases write a function differently, `Sql` writes PostgreSQL and `Sql.for(driver)` the given
 * database: `Sql.for('mysql').length(t.name)` is `CHAR_LENGTH("t"."name")`.
 * Unlike `tableHelper`'s `count` and `sum`, `Sql.count` and `Sql.sum` neither cast nor replace NULL.
 */
export type SqlFunctions = ReturnType<typeof createFunctions> & {
  /**
   * The same helpers for another database: `Sql.for('mysql')`, `Sql.for(dataSource.options.type)`. With
   * `{ syntax: 'filter' }` the aggregates write `filter` as `FILTER (WHERE …)` unless a call sets its own `syntax`.
   */
  for(driver: DatabaseType, options?: SqlOptions): SqlFunctions;
};

function createSql(driver?: DatabaseType, options?: SqlOptions): SqlFunctions {
  return { ...createFunctions(driver, options), for: (otherDriver: DatabaseType, otherOptions?: SqlOptions) => createSql(otherDriver, otherOptions) };
}

export const Sql: SqlFunctions = createSql();
