---
sidebar_position: 3
---

# Sql

## Description

`Sql` writes SQL functions and keywords, so a query built as a string doesn't depend on spelling them by hand: `Sql.max(t.createdAt)` is `MAX("t"."createdAt")`. Each function takes SQL expressions, such as the columns of a [`tableHelper`](./tableHelper.md) (`t.createdAt`, checked against the entity type), other `Sql` functions or SQL text, and writes them as they are. Where a value fits (`coalesce`, `nullif`, `greatest`, `least`, `concat`, `case` values, the aggregates, `round`, `abs`, `floor`, `ceil`, `cast`, the default of `lag` / `lead`, the values of `jsonBuildObject`) a number goes too, written as a literal: `Sql.coalesce(Sql.sum(o.total), 0)`. It throws a `TypeError` for an expression that is missing or empty, or a number that is `NaN` or infinite, which is what a misspelled column of an untyped object gives.

```typescript
import { Sql, tableHelper } from 'typeorm-extensions';

const o = tableHelper<Order>('o');

query
  .select(Sql.count(), 'orders')                                          // COUNT(*)
  .addSelect(Sql.count(o.userId, { distinct: true }), 'buyers')           // COUNT(DISTINCT "o"."userId")
  .addSelect(Sql.coalesce(Sql.sum(o.total), 0), 'revenue')                // COALESCE(SUM("o"."total"), 0)
  .addSelect(Sql.max(o.paidAt, { filter: o.isNotNull('paidAt') }), 'lastPaid')
  .andWhere(`${o.createdAt} >= ${Sql.ago(30, 'days')}`);                  // (NOW() - INTERVAL '30 days')
```

## Databases: `Sql.for(driver)`

Where the databases write a function differently, `Sql` writes PostgreSQL. `Sql.for(driver)` returns the same functions for another database, by TypeORM's database type: `Sql.for('mysql')`, `Sql.for('better-sqlite3')`, `Sql.for(dataSource.options.type)`.

```typescript
const sql = Sql.for('mysql');

sql.length(u.name);         // CHAR_LENGTH("u"."name"): MySQL's LENGTH counts bytes
sql.ago(30, 'days');        // (NOW() - INTERVAL 30 DAY)
Sql.for('sqlite').ago(30, 'days'); // datetime('now', '-30 days')
```

A function a database has no form of throws a `TypeError` naming it: `Sql.for('mysql').boolOr(…)`, `Sql.for('sqlite').interval(…)`.

## Functions

Aggregates take the [options](#aggregate-options) `distinct`, `filter` and `syntax`.

| Function | PostgreSQL (`Sql`) | MySQL / MariaDB | SQLite |
|---|---|---|---|
| `count(expression?)`, `count({ filter })` | `COUNT(expression)`, `COUNT(*)` without one | same | same |
| `sum`, `min`, `max`, `avg(expression)` | `SUM(…)`, `MIN(…)`, `MAX(…)`, `AVG(…)` | same | same |
| `boolOr`, `boolAnd(condition)` | `BOOL_OR(…)`, `BOOL_AND(…)` | — | — |
| `arrayAgg(expression, { distinct?, orderBy?, filter? })` | `ARRAY_AGG(DISTINCT … ORDER BY …) FILTER (WHERE …)` | — | — |
| `jsonAgg(expression, { distinct?, orderBy?, filter? })` | `json_agg(…)` | `JSON_ARRAYAGG(…)`, no options | `json_group_array(…)`; `orderBy` from 3.44, `filter` from 3.30 |
| `jsonbAgg(expression, { … })` | `jsonb_agg(…)` | — | — |
| `percentileCont`, `percentileDisc(fraction, orderBy)` | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY …)` | — | — |
| `mode(expression)` | `MODE() WITHIN GROUP (ORDER BY …)` | — | — |
| `stringAgg(expression, separator, { orderBy? })` | `STRING_AGG(expression, ', ' ORDER BY …)` | `GROUP_CONCAT(expression ORDER BY … SEPARATOR ', ')` | `GROUP_CONCAT(expression, ', ')`; no `distinct`, `orderBy` from 3.44 |
| `coalesce(a, b, …)` | `COALESCE(a, b, …)` | same | same |
| `nullif(a, b)` | `NULLIF(a, b)` | same | same |
| `greatest`, `least(a, b, …)` | `GREATEST(…)`, `LEAST(…)`, NULL arguments skipped | same, NULL for any NULL | `MAX(…)`, `MIN(…)`, NULL for any NULL |
| `case([[condition, value], …], otherwise?)` | `CASE WHEN … THEN … ELSE … END` | same | same |
| `lower`, `upper`, `trim(expression)` | `LOWER(…)`, `UPPER(…)`, `TRIM(…)` | same | same |
| `length(expression)` | `LENGTH(…)`, characters | `CHAR_LENGTH(…)` | `LENGTH(…)` |
| `concat(a, b, …)` | `CONCAT(a, b)`, NULL read as empty | `CONCAT_WS('', a, b)`, NULL read as empty | `COALESCE(a, '') \|\| COALESCE(b, '')` |
| `substring(expression, start, length?)` | `SUBSTRING(expression, start, length)` | same | `SUBSTR(…)` |
| `splitPart(expression, delimiter, n)` | `SPLIT_PART(expression, '@', 2)` | — | — |
| `round(expression, digits?)` | `ROUND(…)`; digits only for a `numeric`: `Sql.round(Sql.cast(x, 'numeric'), 2)` | same | same, a negative digits read as 0 |
| `abs`, `floor`, `ceil(expression)` | `ABS(…)`, `FLOOR(…)`, `CEIL(…)` | same | same (3.35+ with math functions) |
| `cast(expression, type)` | `CAST(expression AS type)`; a type name with an optional size and `[]`, anything else throws | same | same |
| `now()` | `NOW()` | `NOW()` | `CURRENT_TIMESTAMP` |
| `interval(amount, unit)` | `INTERVAL '30 days'`; `make_interval(days => :n)` for `{ sql: ':n' }` | `INTERVAL 30 DAY`, `INTERVAL (:n) DAY` | — |
| `addInterval(expression, amount, unit)` | `(expression + INTERVAL '30 days')`, `-` for a negative amount | `(expression + INTERVAL 30 DAY)` | `datetime(expression, '+30 days')`, `datetime(expression, '+' \|\| (:n) \|\| ' days')`; text |
| `ago(amount, unit)` | `(NOW() - INTERVAL '30 days')` | `(NOW() - INTERVAL 30 DAY)` | `datetime('now', '-30 days')`, text |
| `extract(part, expression)` | `EXTRACT(YEAR FROM …)`, a `numeric` | `EXTRACT(…)`; `UNIX_TIMESTAMP(…)` for `'epoch'`, `DAYOFWEEK(…) - 1` for `'dow'` | `CAST(strftime('%Y', …) AS integer)` |
| `atTimeZone(expression, zone)` | `(expression AT TIME ZONE 'Europe/Kyiv')`; an offset `'+02:00'` is UTC+2; a column is `{ sql: e.timezone }` | — | — |
| `dateTrunc(unit, expression, zone?)` | `DATE_TRUNC('day', expression[, 'Europe/Kyiv'])`, the zone from PostgreSQL 12 | — | — |
| `toChar(expression, format)` | `TO_CHAR(expression, 'YYYY-MM-DD')` | — | — |
| `rowNumber()`, `rank()`, `denseRank()` | `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()` | same (8+) | same (3.25+) |
| `lag`, `lead(expression, offset?, default?)` | `LAG(…)`, `LEAD(…)` | same (8+) | same (3.25+) |
| `over(fn, { partitionBy?, orderBy? })` | `fn OVER (PARTITION BY … ORDER BY …)` | same (8+) | same (3.25+) |
| `distinctOn(a, …)` | `DISTINCT ON (a, …)`, for a SELECT written as SQL; a query builder has [`distinctOnTyped`](../typed/distinctOnTyped.md) | — | — |
| `json(expression, 'a', 0, …)` | `(expression -> 'a' -> 0)` | `JSON_EXTRACT(expression, '$."a"[0]')` | `(expression -> '$."a"[0]')`, 3.38+ |
| `jsonText(expression, 'a', 'b', …)` | `(expression -> 'a' ->> 'b')`, text | `JSON_UNQUOTE(JSON_EXTRACT(…))`; a JSON `null` gives `'null'` | `(expression ->> '$."a"."b"')`, an SQL value, 3.38+ |
| `jsonBuildObject({ key: expression, … })` | `json_build_object('key', expression, …)` | `JSON_OBJECT(…)` | `json_object(…)` |
| `jsonbBuildObject({ key: expression, … })` | `jsonb_build_object(…)` | — | — |
| `jsonbSet(target, ['a', 'b'], value, { createMissing? })` | `jsonb_set(target, ARRAY['a', 'b'], value)` | — | — |
| `jsonbMerge(target, patch)` | `(COALESCE(target, CAST('{}' AS jsonb)) \|\| patch)` | — | — |
| `toJsonb`, `jsonbTypeof`, `jsonbArrayElements(expression)` | `to_jsonb(…)`, `jsonb_typeof(…)`, `jsonb_array_elements(…)` | — | — |

Units of `interval`, `addInterval` and `ago`: `'seconds'`, `'minutes'`, `'hours'`, `'days'`, `'weeks'`, `'months'`, `'years'`; the amount is an integer or an SQL expression, `{ sql: ':days' }`. Parts of `extract`: `'year'`, `'month'`, `'day'`, `'hour'`, `'minute'`, `'second'`, `'epoch'` (seconds since 1970) and `'dow'` (day of the week from 0, Sunday). The amount, the unit, the part, the separator, the delimiter, the format, a time zone name and the keys of a JSON path or object are checked or written as SQL strings, so they can't carry SQL; on MySQL and SQLite a key of a JSON path has no `"` or `\`.

A [`tableHelper`](./tableHelper.md) has forms of `arrayAgg` and `jsonAgg` over a column of its table that give an empty array instead of NULL for no rows, and `jsonColumn` reads a path typed against the entity; `Sql` takes any expression and writes the function alone. `arrayAgg` and the JSON arrays write `filter` as `FILTER (WHERE …)`: a CASE would leave a NULL in the array for each skipped row.

```typescript
Sql.over(Sql.rowNumber(), { partitionBy: o.userId, orderBy: `${o.createdAt} DESC` })
// ROW_NUMBER() OVER (PARTITION BY "o"."userId" ORDER BY "o"."createdAt" DESC)

Sql.case([[o.where('total', '> 100'), "'big'"]], "'small'")
// CASE WHEN "o"."total" > 100 THEN 'big' ELSE 'small' END
```

## Aggregate options

- `distinct?: boolean`: each value once, `COUNT(DISTINCT expression)`. `Sql.count()` needs an expression for it.
- `filter?: string`: aggregates only the rows that match the condition.
- `syntax?: 'case' | 'filter'`: how `filter` is written. `'case'` (default) gives `MAX(CASE WHEN filter THEN expression END)`, in every database; `'filter'` gives `MAX(expression) FILTER (WHERE filter)`, PostgreSQL and SQLite 3.30+. `Sql.for(driver, { syntax: 'filter' })` changes the default for its functions.

`Sql.count({ filter })` counts the matching rows, the same as `Sql.count(undefined, { filter })`.

## Notes

- **The function's own result.** `Sql.count` and `Sql.sum` write the function and nothing else, so they replace a hand-written `COUNT(…)` / `SUM(…)` without changing what the query returns: the `pg` driver returns a count, a `bigint` sum and a `numeric` as strings, and `SUM`, `MIN`, `MAX` and `AVG` give NULL for no rows. `tableHelper`'s [`count`](./tableHelper.md#counting) casts to an integer and its [`sum`](./tableHelper.md#sums) gives 0 instead of NULL; `Sql.coalesce(Sql.sum(…), '0')` does the same by hand.
- **Values.** Expressions are written as they are, so a value from a user goes into a parameter (`':since'`), never into the string.
