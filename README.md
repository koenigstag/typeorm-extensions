# TypeORM Extensions

[![npm version](https://badge.fury.io/js/typeorm-extensions.svg)](https://badge.fury.io/js/typeorm-extensions)
[![npm downloads](https://img.shields.io/npm/dm/typeorm-extensions)](https://www.npmjs.com/package/typeorm-extensions)
[![Issues](https://img.shields.io/github/issues-raw/koenigstag/typeorm-extensions.svg?maxAge=25000)](https://github.com/koenigstag/typeorm-extensions/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/koenigstag/typeorm-extensions/pulls)

**Type-safe extensions for the TypeORM QueryBuilder.** Write selects, joins, conditions and ordering as property callbacks the compiler checks against your entities, page through results with totals or cursors, and build the raw SQL you still need with helpers that quote it for the database.

```typescript
import 'typeorm-extensions';

const { list, total, hasMore } = await dataSource
  .getRepository(UserEntity)
  .createQueryBuilder('user')
  .leftJoinTyped(user => user.images, 'images')
  .whereTyped(user => user.createdAt, '>', since)
  // a key inside a JSON column: "user"."metadata" ->> 'role' = :param
  .andWhereTyped(user => user.metadata.role, '=', 'admin')
  .orderByTyped(user => user.images.url, 'ASC', 'NULLS LAST')
  .getManyWithTotals({ page: 1, pageSize: 20 });
```

Try it in the [playground](https://koenigstag.github.io/typeorm-extensions/playground/): an editor and a database in the browser.

## Why

The QueryBuilder takes columns as strings. A renamed property, a typo or a half-quoted alias compiles and then fails at runtime:

```typescript
.where('user.createdAt > :since', { since })   // still compiles after createdAt is renamed
.andWhere('order."userId" = :userId', { userId }) // PostgreSQL: syntax error at or near "order"
```

With the extensions a column is a property of the entity type, so the compiler catches the rename, and the SQL is built and quoted for you:

```typescript
.whereTyped(user => user.createdAt, '>', since)

const orders = tableHelper(OrderEntity, 'order');
.andWhere(`${orders.userId} = :userId`, { userId }) // "order"."userId" = :userId
```

## Installation

```bash
npm install typeorm-extensions
```

`typeorm` 0.3.12 or later, or 1.x, is a peer dependency. Release candidates of the next version are published under the `next` tag: `npm install typeorm-extensions@next`.

## Features

**Typed queries** ([docs](https://koenigstag.github.io/typeorm-extensions/docs/api/typed/))
- `selectTyped`, `whereTyped` (keys inside JSON columns too; `strictParams` checks the parameter against the column type), `orderByTyped`, `groupByTyped` / `havingTyped`, `distinctOnTyped`, `returningTyped`
- typed joins and map joins (`leftJoinTyped`, `innerJoinAndMapOneTyped`, …), `typed<Root>()` for the aliases a query joins, `whereRelationExists` built from the relation metadata

**Pagination** ([docs](https://koenigstag.github.io/typeorm-extensions/docs/api/pagination/))
- `getManyWithTotals` and `getRawManyWithTotals`: the rows of a page, the total, `page` / `pageSize`, `hasMore` and the order it was read in
- `getManyWithCursor`: keyset pagination with an opaque cursor
- `applyPaginationFilter` for a page of any query

**Filters and ordering** ([docs](https://koenigstag.github.io/typeorm-extensions/docs/api/where/))
- `whereIsIn` / `whereIsNotIn` that handle empty arrays, `whereIsAny`, null-safe `whereIsDistinctFrom`
- case-insensitive search with escaped wildcards, `applyPeriodFilter` in a time zone
- `applyOrder` from a client's order filter, `orderByArrayPosition`

**Subqueries and joins**
- `whereExists` / `whereNotExists`, with the subquery's parameters renamed so they never clash with the outer query's
- `leftJoinLateral` / `innerJoinLateral`, `innerJoinUnnest`, `fromUnion` and CTE unions

**SQL helpers** ([docs](https://koenigstag.github.io/typeorm-extensions/docs/api/utils/tableHelper/))
- `tableHelper`: quoted column references, conditions, counts, sums, JSON objects and paths, time zones. Given the entity class it writes the database name of a renamed column
- the reserved qualifier guard: catches SQL like `order."userId"` before PostgreSQL rejects it

**Columns** ([docs](https://koenigstag.github.io/typeorm-extensions/docs/api/columns/generatedColumn/))
- `@CalculatedColumn` with `addSelectCalculated` / `orderByCalculated`: a value each query computes
- `@GeneratedColumn`: a column the database generates, which TypeORM reads and never writes

## Entry points

| Import | Gives |
|---|---|
| `import 'typeorm-extensions'` | every QueryBuilder extension, and all exports |
| `import 'typeorm-extensions/dist/extensions/pagination.extension'` | one extension |
| `import { tableHelper, GeneratedColumn } from 'typeorm-extensions/helpers'` | the helpers, with no side effects |

## Compatibility

TypeORM 0.3.12 and later, and 1.x. CI runs the test suite on SQLite with TypeORM 0.3.12, the latest 0.3 and 1.x, and on MySQL 8.4. Features that only work on some databases (array and JSON operators, `DISTINCT ON`, `orderByArrayPosition`, …) say so in their docs.

## Documentation

The [documentation](https://koenigstag.github.io/typeorm-extensions/) has a page for every method, with its signature, options and examples, and the [playground](https://koenigstag.github.io/typeorm-extensions/playground/) runs them.

## ToDo list

- [x] Add tests for pagination and order extensions
- [x] Calculated columns: the `@CalculatedColumn` decorator and `addSelectCalculated`. `getMany`, `getOne` and `getManyWithTotals` fill them as they are, so they need no variants of their own
- [x] Order by a calculated column: `orderByCalculated`, and `applyOrder` orders a `@CalculatedColumn` field by its value
- [x] Generated columns: the `@GeneratedColumn` decorator, a `@Column` that TypeORM reads and never writes
- [x] `tableHelper(Entity, alias)` writes the database names of renamed columns

## License

[MIT](./LICENSE)
