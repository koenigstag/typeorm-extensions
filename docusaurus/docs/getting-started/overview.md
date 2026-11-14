---
sidebar_position: 1
---

# Overview

Type-safe extensions for the [TypeORM](https://www.npmjs.com/package/typeorm) QueryBuilder. Write selects, joins, conditions and ordering as property callbacks the compiler checks against your entities, page through results with totals or cursors, and build the raw SQL you still need with helpers that quote it for the database. The [playground](/playground) runs them in the browser.

## Features

- **[Typed queries](/docs/api/typed/)**: methods that take property callbacks instead of strings.
  - `selectTyped`, `orderByTyped`, `groupByTyped` / `havingTyped`, `distinctOnTyped` (only PostgreSQL), `returningTyped` for INSERT / UPDATE / DELETE.
  - `whereTyped`, also on keys inside JSON columns; parameters can be checked against the column type (`strictParams`).
  - `whereIsInTyped`, `whereIsAnyTyped` (only PostgreSQL), case-insensitive search with escaped wildcards (`whereILikeTyped`, `whereSearchTyped`, `whereLowerEqualsTyped`), trigram similarity (`whereSimilarTyped`, only PostgreSQL).
  - typed joins and map joins (`leftJoinTyped`, `innerJoinAndMapOneTyped`, …), `typed<Root>()` for the aliases a query joins, `whereRelationExists` built from the relation metadata.
- **[Pagination](/docs/api/pagination/)**: a page with its total, `hasMore` and the order it was read in (`getManyWithTotals`, `getRawManyWithTotals`), keyset pages with a cursor (`getManyWithCursor`), or a page of any query (`applyPagination`).
- **[Where](/docs/api/where/)**: `whereIsIn` / `whereIsNotIn` that handle empty arrays; `whereIsAny` for `= ANY(array)` with the array bound as one parameter, array and JSON operators (only PostgreSQL); null-safe `whereIsDistinctFrom`; period filters in a time zone (`applyPeriodFilter`); `whereExists` / `whereNotExists` with the subquery's parameters renamed apart.
- **[Order](/docs/api/order/)**: order from a client's filter (`applyOrder`), or by the position in an array of ids (`orderByArrayPosition`, only PostgreSQL).
- **Joins and unions**: [`leftJoinLateral` / `innerJoinLateral`](/docs/api/joins/joinLateral/), [`innerJoinUnnest`](/docs/api/where/innerJoinUnnest/), [`fromUnion` and CTE unions](/docs/api/subqueries/union/).
- **[tableHelper](/docs/api/utils/tableHelper/)**: typesafe SQL fragments: column references, conditions, joins, counts, sums, JSON objects and paths, time zones. Given the entity class, it writes the database name of a renamed column.
- **Columns**: [`@CalculatedColumn`](/docs/api/columns/calculatedColumn/), a value each query computes; [`@GeneratedColumn`](/docs/api/columns/generatedColumn/), a column the database generates, which TypeORM reads and never writes.
- **[Reserved qualifier guard](/docs/api/utils/reservedQualifierGuard/)**: an opt-in check of the SQL each query runs for a reserved word used as a qualifier without quotes (`order."userId"`, `user.id`), which PostgreSQL rejects; it throws or warns before the query runs (only PostgreSQL and CockroachDB).

## Getting Started

Get started by **installing the package**:

```bash
npm install typeorm-extensions
```

Then **import the package root** to init all extensions:

```typescript
import 'typeorm-extensions';
```

Or import specific extension to init only it, if needed:

```typescript
import 'typeorm-extensions/dist/extensions/name.extension';
```

Helpers are exported from the package root, and from `typeorm-extensions/helpers`, which installs no extension. Use the latter if you import extensions one by one:

```typescript
import { tableHelper } from 'typeorm-extensions/helpers'; // no side effects
import { tableHelper } from 'typeorm-extensions'; // also installs all extensions
```

### What you'll need

- [typeorm](https://www.npmjs.com/package/typeorm) `^0.3.12` or `^1.0.0`

## Use new query builder methods

Examples can be found in the [Docs/Examples](/docs/examples) section, and every method is described in the [API reference](/docs/api/core/).
