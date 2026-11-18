---
sidebar_position: 3
---

# Sql

## Description

`Sql` writes SQL functions and keywords, so a query built as a string doesn't depend on spelling them by hand: `Sql.max(t.createdAt)` is `MAX("t"."createdAt")`. Each function takes SQL expressions, such as the columns of a [`tableHelper`](./tableHelper.md) (`t.createdAt`, checked against the entity type), other `Sql` functions or SQL text, and writes them as they are. It throws a `TypeError` for an expression that is missing or empty, which is what a misspelled column of an untyped object gives.

```typescript
import { Sql, tableHelper } from 'typeorm-extensions';

const o = tableHelper<Order>('o');

query
  .select(Sql.count(), 'orders')                                          // COUNT(*)
  .addSelect(Sql.count(o.userId, { distinct: true }), 'buyers')           // COUNT(DISTINCT "o"."userId")
  .addSelect(Sql.coalesce(Sql.sum(o.total), '0'), 'revenue')              // COALESCE(SUM("o"."total"), 0)
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
| `count(expression?)` | `COUNT(expression)`, `COUNT(*)` without one | same | same |
| `sum`, `min`, `max`, `avg(expression)` | `SUM(…)`, `MIN(…)`, `MAX(…)`, `AVG(…)` | same | same |
| `boolOr`, `boolAnd(condition)` | `BOOL_OR(…)`, `BOOL_AND(…)` | — | — |
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
| `cast(expression, type)` | `CAST(expression AS type)`; a type name with an optional size and `[]`, anything else throws | same | same |
| `now()` | `NOW()` | `NOW()` | `CURRENT_TIMESTAMP` |
| `interval(amount, unit)` | `INTERVAL '30 days'` | `INTERVAL 30 DAY` | — |
| `addInterval(expression, amount, unit)` | `(expression + INTERVAL '30 days')`, `-` for a negative amount | `(expression + INTERVAL 30 DAY)` | `datetime(expression, '+30 days')`, text |
| `ago(amount, unit)` | `(NOW() - INTERVAL '30 days')` | `(NOW() - INTERVAL 30 DAY)` | `datetime('now', '-30 days')`, text |
| `extract(part, expression)` | `EXTRACT(YEAR FROM …)`, a `numeric` | `EXTRACT(…)`; `UNIX_TIMESTAMP(…)` for `'epoch'`, `DAYOFWEEK(…) - 1` for `'dow'` | `CAST(strftime('%Y', …) AS integer)` |
| `toChar(expression, format)` | `TO_CHAR(expression, 'YYYY-MM-DD')` | — | — |
| `rowNumber()`, `rank()`, `denseRank()` | `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()` | same (8+) | same (3.25+) |
| `lag`, `lead(expression, offset?, default?)` | `LAG(…)`, `LEAD(…)` | same (8+) | same (3.25+) |
| `over(fn, { partitionBy?, orderBy? })` | `fn OVER (PARTITION BY … ORDER BY …)` | same (8+) | same (3.25+) |
| `distinctOn(a, …)` | `DISTINCT ON (a, …)`, for a SELECT written as SQL; a query builder has [`distinctOnTyped`](../typed/distinctOnTyped.md) | — | — |
| `jsonbSet(target, ['a', 'b'], value, { createMissing? })` | `jsonb_set(target, ARRAY['a', 'b'], value)` | — | — |
| `toJsonb`, `jsonbTypeof`, `jsonbArrayElements(expression)` | `to_jsonb(…)`, `jsonb_typeof(…)`, `jsonb_array_elements(…)` | — | — |

Units of `interval`, `addInterval` and `ago`: `'seconds'`, `'minutes'`, `'hours'`, `'days'`, `'weeks'`, `'months'`, `'years'`, an integer amount. Parts of `extract`: `'year'`, `'month'`, `'day'`, `'hour'`, `'minute'`, `'second'`, `'epoch'` (seconds since 1970) and `'dow'` (day of the week from 0, Sunday). The amount, the unit, the part, the separator, the delimiter, the format and the keys of a JSON path are checked or written as SQL strings, so they can't carry SQL.

```typescript
Sql.over(Sql.rowNumber(), { partitionBy: o.userId, orderBy: `${o.createdAt} DESC` })
// ROW_NUMBER() OVER (PARTITION BY "o"."userId" ORDER BY "o"."createdAt" DESC)

Sql.case([[o.where('total', '> 100'), "'big'"]], "'small'")
// CASE WHEN "o"."total" > 100 THEN 'big' ELSE 'small' END
```

## Aggregate options

- `distinct?: boolean`: each value once, `COUNT(DISTINCT expression)`. `Sql.count()` needs an expression for it.
- `filter?: string`: aggregates only the rows that match the condition.
- `syntax?: 'case' | 'filter'`: how `filter` is written. `'case'` (default) gives `MAX(CASE WHEN filter THEN expression END)`, in every database; `'filter'` gives `MAX(expression) FILTER (WHERE filter)`, PostgreSQL and SQLite 3.30+.

## Notes

- **The function's own result.** `Sql.count` and `Sql.sum` write the function and nothing else, so they replace a hand-written `COUNT(…)` / `SUM(…)` without changing what the query returns: the `pg` driver returns a count, a `bigint` sum and a `numeric` as strings, and `SUM`, `MIN`, `MAX` and `AVG` give NULL for no rows. `tableHelper`'s [`count`](./tableHelper.md#counting) casts to an integer and its [`sum`](./tableHelper.md#sums) gives 0 instead of NULL; `Sql.coalesce(Sql.sum(…), '0')` does the same by hand.
- **Values.** Expressions are written as they are, so a value from a user goes into a parameter (`':since'`), never into the string.
