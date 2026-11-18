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
  .addSelect(Sql.greatest(o.updatedAt, o.paidAt), 'touched');             // GREATEST("o"."updatedAt", "o"."paidAt")
```

## Functions

| Function | Result |
|---|---|
| `Sql.count(expression?, options?)` | `COUNT(expression)`, `COUNT(*)` without one |
| `Sql.sum(expression, options?)` | `SUM(expression)` |
| `Sql.min(expression, options?)` | `MIN(expression)` |
| `Sql.max(expression, options?)` | `MAX(expression)` |
| `Sql.avg(expression, options?)` | `AVG(expression)` |
| `Sql.boolOr(condition, options?)` | `BOOL_OR(condition)`, PostgreSQL |
| `Sql.boolAnd(condition, options?)` | `BOOL_AND(condition)`, PostgreSQL |
| `Sql.coalesce(a, b, …)` | `COALESCE(a, b, …)`, two expressions or more |
| `Sql.nullif(a, b)` | `NULLIF(a, b)` |
| `Sql.greatest(a, b, …)` | `GREATEST(a, b, …)`, two expressions or more |
| `Sql.least(a, b, …)` | `LEAST(a, b, …)`, two expressions or more |
| `Sql.lower(expression)` | `LOWER(expression)` |
| `Sql.upper(expression)` | `UPPER(expression)` |
| `Sql.cast(expression, type)` | `CAST(expression AS type)`; `type` is a type name with an optional size and `[]` (`'numeric(10, 2)'`, `'uuid[]'`), anything else throws |
| `Sql.distinctOn(a, …)` | `DISTINCT ON (a, …)` for a SELECT written as SQL, PostgreSQL; a query builder has [`distinctOnTyped`](../typed/distinctOnTyped.md) |

The options of the aggregates:

- `distinct?: boolean`: each value once, `COUNT(DISTINCT expression)`. `Sql.count()` needs an expression for it.
- `filter?: string`: aggregates only the rows that match the condition.
- `syntax?: 'case' | 'filter'`: how `filter` is written. `'case'` (default) gives `MAX(CASE WHEN filter THEN expression END)`, in every database; `'filter'` gives `MAX(expression) FILTER (WHERE filter)`, PostgreSQL and SQLite 3.30+.

## Notes

- **The function's own result.** `Sql.count` and `Sql.sum` write the function and nothing else, so they replace a hand-written `COUNT(…)` / `SUM(…)` without changing what the query returns: the `pg` driver returns a count as a string, and `SUM`, `MIN`, `MAX` and `AVG` give NULL for no rows. `tableHelper`'s [`count`](./tableHelper.md#counting) casts to an integer and its [`sum`](./tableHelper.md#sums) gives 0 instead of NULL; `Sql.coalesce(Sql.sum(…), '0')` does the same by hand.
- **NULL arguments of `greatest` / `least`.** PostgreSQL skips them, MySQL returns NULL when any is NULL. SQLite has neither function: its `MAX(a, b)` / `MIN(a, b)` return NULL for any NULL argument.
- **Values.** Expressions are written as they are, so a value from a user goes into a parameter (`':since'`), never into the string.
