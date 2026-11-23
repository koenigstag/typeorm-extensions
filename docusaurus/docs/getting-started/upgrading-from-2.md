---
sidebar_position: 2
---

# Upgrading from 2.x

3.0 keeps the 2.x API: every export of 2.1.0 is still there except the ones removed below. Most code upgrades by bumping the version. TypeScript points at everything in the first part; the second part compiles as before and needs a search of your code.

## What TypeScript flags

| 2.x | 3.0 |
|---|---|
| `query.applyPaginationFilter(filter)` | `query.applyPagination(filter)`: the same arguments and result |
| `t.jsonColumn('metadata', '->>', 'role')` | `t.jsonText((r) => r.metadata.role)` |
| `t.jsonColumn('metadata', '->', 'settings')`, `t.jsonPath(…)` | `t.json((r) => r.metadata.settings)` |
| `returningTyped((t) => [t.id, t.status])` | `returningTyped((t) => ({ id: t.id, status: t.status }))` |
| the `JsonFieldRest` type | removed: only `jsonColumn` / `jsonPath` used it |
| `WhereInMethods` / `WhereAnyMethods` | still there, deprecated: `WhereIsInMethodName` / `WhereIsAnyMethodName` |

Code that builds a `ListWithTotals` or a `ListWithCursor` itself, such as a test mock or a wrapper, adds `hasMore` and `pageSize`, and `page` for `ListWithTotals`. Code that only reads them needs no change.

## What to check in your code

- **Rows from `returningTyped`.** The rows in `execute()`'s `raw` are keyed by the output names you give, not by the database column names, and hold only those outputs: an INSERT no longer adds its generated columns. Look at the code that reads `raw` after a `returningTyped`.
- **Typed keys of an alias without an entity.** `selectTyped`, `orderByTyped`, `groupByTyped` and `distinctOnTyped` now quote the keys of a subquery, a CTE or a table that isn't an entity, as the typed where methods already did. A column that raw SQL names without quotes (`SELECT id AS userId`) is `userid` on PostgreSQL, so `cte.userId` no longer matches it: quote the name in the SQL, `AS "userId"`.
- **Cursors issued by 2.x.** Cursors now name the direction of their keys. A descending cursor from 2.x gets an `InvalidCursorError` once; ascending cursors keep working. If clients hold cursors across your deploy, answer that error by starting the list again from its first page.
- **Inputs that now throw a `TypeError`.** 2.x dropped them or read them as something else:
  - a params object after the condition with more than one key, or none: `whereTyped((u) => u.id, '=', { id, email })`;
  - `applyOrder` / `applyOrderFilter` with `useQuotes: false` and an expression in place of a column name;
  - an order without a `field`;
  - `whereIsIn` / `whereIsAny` / `innerJoinUnnest` given a value that is neither a list nor one value, such as the object a query string makes of a long list;
  - `whereArrayContains`, `whereArrayContainedBy` and `whereArrayOverlaps` on a database other than PostgreSQL: MySQL read `&&` as a logical AND and returned the wrong rows.
  - `whereSimilarTyped` (and `and…` / `or…`) and `addSimilarityScoreTyped` on a database other than PostgreSQL: there `%` is the modulo operator, so the query ran and matched no row. They throw even for a blank term. `whereSearchTyped` without the new `similar` option works on every database as before.
- **Pool connections.** Without a query runner of its own, `getManyWithTotals` runs the count and the page at the same time and holds two pool connections for the call, where 2.x held one. Size the pool for it, or pass `disableTotalsCalculation` where a list needs no total.

## No action needed

Most entries under Bug Fixes in the [changelog](https://github.com/koenigstag/typeorm-extensions/blob/main/CHANGELOG.md) turn SQL the database rejected into SQL that runs, or into a `TypeError` that names the call. Code that worked needs no change for them.
