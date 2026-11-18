import type { DatabaseType } from 'typeorm';
import { isMysqlLikeDriver, isPostgresLikeDriver, isSqliteLikeDriver } from './sql.utils';
import { filtered, sqlString } from './aggregate.utils';

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

export type SqlStringAggOptions = SqlAggregateOptions & {
  /** Orders the values: an SQL expression, with `ASC` / `DESC` if needed. On SQLite, 3.44+. */
  orderBy?: string;
};

export type SqlWindow = {
  /** `PARTITION BY`: one expression or several. */
  partitionBy?: string | readonly string[];
  /** `ORDER BY`: one expression or several, each with `ASC` / `DESC` if needed. */
  orderBy?: string | readonly string[];
};

export type SqlIntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

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

function expressions(method: string, values: readonly unknown[], least: number): string {
  if (values.length < least) {
    throw new TypeError(`Sql.${method}() needs at least ${least} expressions, got ${values.length}`);
  }

  return values.map((value, index) => expression(method, value, `argument ${index + 1}`)).join(', ');
}

function integer(method: string, value: unknown, position: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`Sql.${method}(): the ${position} is an integer, got ${String(value)}`);
  }

  return value;
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
function createFunctions(driver?: DatabaseType) {
  const dialect = toDialect(driver);
  const name = driver ?? 'postgres';

  const only = (method: string, ...dialects: Dialect[]): void => {
    if (!dialects.includes(dialect)) {
      throw new TypeError(`Sql.${method}() has no equivalent on ${name}`);
    }
  };

  const aggregate = (fn: string, method: string, value: string, aggregateOptions: SqlAggregateOptions = {}): string => {
    if (typeof aggregateOptions !== 'object' || aggregateOptions === null) {
      throw new TypeError(`Sql.${method}(): the second argument is an options object, e.g. { filter: "…" }`);
    }

    const { distinct = false, filter, syntax } = aggregateOptions;
    const { argument, suffix } = filtered(`Sql.${method}`, value, filter, syntax, driver);

    return `${fn}(${distinct ? 'DISTINCT ' : ''}${argument})${suffix}`;
  };

  // the SQL that moves `value` by `amount` units of time: a negative amount moves it back
  const shift = (method: string, value: string, amount: number, unit: SqlIntervalUnit): string => {
    const size = Math.abs(amount);
    const sign = amount < 0 ? '-' : '+';

    if (dialect === 'sqlite') {
      // SQLite's modifiers have no weeks
      const [count, sqliteUnit] = unit === 'weeks' ? [size * 7, 'days'] : [size, unit];

      return `datetime(${value}, '${sign}${count} ${sqliteUnit}')`;
    }

    only(method, 'postgres', 'mysql');

    return `(${value} ${sign} ${dialect === 'mysql' ? `INTERVAL ${size} ${MYSQL_UNITS[unit]}` : `INTERVAL '${size} ${unit}'`})`;
  };

  const now = (): string => (dialect === 'postgres' || dialect === 'mysql' ? 'NOW()' : 'CURRENT_TIMESTAMP');

  return {
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

      const { distinct = false, orderBy, filter, syntax } = aggregateOptions;
      const { argument, suffix } = filtered('Sql.stringAgg', expression('stringAgg', value), filter, syntax, driver);
      const order = orderBy === undefined ? '' : ` ORDER BY ${expression('stringAgg', orderBy, 'orderBy')}`;
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

    /** `COALESCE(a, b, …)`: the first argument that isn't NULL. */
    coalesce(...values: [string, string, ...string[]]): string {
      return `COALESCE(${expressions('coalesce', values, 2)})`;
    },
    /** `NULLIF(a, b)`: NULL when `a` equals `b`, else `a`: `Sql.nullif(t.name, "''")`. */
    nullif(value: string, nullValue: string): string {
      return `NULLIF(${expression('nullif', value, 'first argument')}, ${expression('nullif', nullValue, 'second argument')})`;
    },
    /**
     * `GREATEST(a, b, …)`. PostgreSQL skips NULL arguments, MySQL returns NULL for any; on SQLite it is `MAX(a, b, …)`,
     * NULL for any NULL argument.
     */
    greatest(...values: [string, string, ...string[]]): string {
      return `${dialect === 'sqlite' ? 'MAX' : 'GREATEST'}(${expressions('greatest', values, 2)})`;
    },
    /** `LEAST(a, b, …)`, `MIN(a, b, …)` on SQLite; NULL arguments as in `greatest`. */
    least(...values: [string, string, ...string[]]): string {
      return `${dialect === 'sqlite' ? 'MIN' : 'LEAST'}(${expressions('least', values, 2)})`;
    },
    /** `CASE WHEN condition THEN value … [ELSE otherwise] END`: the value of the first condition that holds. */
    case(branches: readonly (readonly [condition: string, value: string])[], otherwise?: string): string {
      if (!Array.isArray(branches) || !branches.length) {
        throw new TypeError('Sql.case() needs at least one [condition, value] branch');
      }

      const whens = branches.map((branch, index) => {
        if (!Array.isArray(branch) || branch.length !== 2) {
          throw new TypeError(`Sql.case(): branch ${index + 1} is a [condition, value] pair`);
        }

        return `WHEN ${expression('case', branch[0], `condition ${index + 1}`)} THEN ${expression('case', branch[1], `value ${index + 1}`)}`;
      });
      const elseSql = otherwise === undefined ? '' : ` ELSE ${expression('case', otherwise, 'otherwise value')}`;

      return `CASE ${whens.join(' ')}${elseSql} END`;
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
    concat(...values: [string, string, ...string[]]): string {
      const joined = expressions('concat', values, 2);

      if (dialect === 'mysql') {
        return `CONCAT_WS('', ${joined})`;
      }

      if (dialect === 'sqlite') {
        return `(${values.map((value) => `COALESCE(${value}, '')`).join(' || ')})`;
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
    cast(value: string, type: string): string {
      if (typeof type !== 'string' || !SQL_TYPE.test(type.trim())) {
        throw new TypeError(`Sql.cast(): "${String(type)}" is not a type name, e.g. 'numeric', 'numeric(10, 2)', 'uuid[]'`);
      }

      return `CAST(${expression('cast', value)} AS ${type.trim()})`;
    },

    /** The time the transaction (PostgreSQL) or the statement started: `NOW()`, `CURRENT_TIMESTAMP` on SQLite. */
    now,
    /**
     * An interval to add to a time or subtract from it: `INTERVAL '30 days'`, `INTERVAL 30 DAY` on MySQL. SQLite has
     * no intervals: use `addInterval` or `ago`.
     */
    interval(amount: number, unit: SqlIntervalUnit): string {
      only('interval', 'postgres', 'mysql');

      const size = integer('interval', amount, 'amount');
      const checked = intervalUnit('interval', unit);

      return dialect === 'mysql' ? `INTERVAL ${size} ${MYSQL_UNITS[checked]}` : `INTERVAL '${size} ${checked}'`;
    },
    /**
     * The time `amount` units after `expression`, before it for a negative amount: `("t"."paidAt" + INTERVAL '30 days')`;
     * `datetime(…, '+30 days')` on SQLite, which gives text.
     */
    addInterval(value: string, amount: number, unit: SqlIntervalUnit): string {
      return shift('addInterval', expression('addInterval', value), integer('addInterval', amount, 'amount'), intervalUnit('addInterval', unit));
    },
    /** The time `amount` units ago: `(NOW() - INTERVAL '30 days')`, `datetime('now', '-30 days')` on SQLite. */
    ago(amount: number, unit: SqlIntervalUnit): string {
      const size = integer('ago', amount, 'amount');
      const checked = intervalUnit('ago', unit);

      return dialect === 'sqlite' ? shift('ago', `'now'`, -size, checked) : shift('ago', now(), -size, checked);
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

    /** `ROW_NUMBER()`, for `over`. */
    rowNumber: (): string => 'ROW_NUMBER()',
    /** `RANK()`, for `over`: ties share a rank and leave a gap after them. */
    rank: (): string => 'RANK()',
    /** `DENSE_RANK()`, for `over`: ties share a rank, without a gap. */
    denseRank: (): string => 'DENSE_RANK()',
    /** `LAG(expression[, offset[, default]])`, for `over`: the value `offset` rows before, 1 by default. */
    lag(value: string, offset?: number, defaultValue?: string): string {
      return windowShift('LAG', 'lag', value, offset, defaultValue);
    },
    /** `LEAD(expression[, offset[, default]])`, for `over`: the value `offset` rows after, 1 by default. */
    lead(value: string, offset?: number, defaultValue?: string): string {
      return windowShift('LEAD', 'lead', value, offset, defaultValue);
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
      ].filter(Boolean);

      return `${expression('over', fn, 'function')} OVER (${parts.join(' ')})`;
    },

    /** `DISTINCT ON (a, b, …)`, for a SELECT written as SQL; a query builder has `distinctOnTyped`. PostgreSQL. */
    distinctOn(...values: [string, ...string[]]): string {
      only('distinctOn', 'postgres');
      return `DISTINCT ON (${expressions('distinctOn', values, 1)})`;
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
  };
}

function windowShift(fn: string, method: string, value: string, offset?: number, defaultValue?: string): string {
  const args = [expression(method, value)];

  if (offset !== undefined || defaultValue !== undefined) {
    args.push(String(integer(method, offset ?? 1, 'offset')));
  }

  if (defaultValue !== undefined) {
    args.push(expression(method, defaultValue, 'default value'));
  }

  return `${fn}(${args.join(', ')})`;
}

/**
 * SQL functions and keywords as helpers, written as they are: `Sql.max(t.createdAt)` is `MAX("t"."createdAt")`.
 * They take SQL expressions, such as the columns of a `tableHelper` (`t.createdAt`) or other helpers, and check
 * only that each is given. Where the databases write a function differently, `Sql` writes PostgreSQL and
 * `Sql.for(driver)` the given database: `Sql.for('mysql').length(t.name)` is `CHAR_LENGTH("t"."name")`.
 * Unlike `tableHelper`'s `count` and `sum`, `Sql.count` and `Sql.sum` neither cast nor replace NULL.
 */
export type SqlFunctions = ReturnType<typeof createFunctions> & {
  /** The same helpers for another database: `Sql.for('mysql')`, `Sql.for(dataSource.options.type)`. */
  for(driver: DatabaseType): SqlFunctions;
};

function createSql(driver?: DatabaseType): SqlFunctions {
  return { ...createFunctions(driver), for: (otherDriver: DatabaseType) => createSql(otherDriver) };
}

export const Sql: SqlFunctions = createSql();
