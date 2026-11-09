---
sidebar_position: 4
---

# orderByArrayPosition

## Description

`orderByArrayPosition` orders rows by the position of the column's value in an array: `array_position(:values, column)`. It keeps the order of ids that come from elsewhere: search results, recommendations, a user-defined order.

- Rows whose value isn't in the array come last (`NULLS LAST`).
- The array is bound as one parameter; `arrayType` (e.g. `'uuid[]'`) casts it. Only a type name is accepted, see [whereIsAny](../where/whereIsAny.md).
- `orderByArrayPosition` replaces the ORDER BY, like `orderBy`; `addOrderByArrayPosition` adds to it, like `addOrderBy`.
- The position is selected under a generated alias (`array_position_…`) and the query is ordered by that alias. TypeORM can't order by a function expression together with `take` / `skip` and joins (`alias was not found`), but it can order by a selection alias. The extra column shows up in `getRawMany()` results.

**PostgreSQL only** (and compatible databases such as CockroachDB). Available on `SelectQueryBuilder`.

## Signature

```typescript
orderByArrayPosition(field: string, values: readonly unknown[], arrayType?: string): this
addOrderByArrayPosition(field: string, values: readonly unknown[], arrayType?: string): this
```

## Arguments

- field: string: Column to order by, e.g. `'product.id'`. It is quoted as an SQL identifier: `"product"."id"`.
- values: readonly unknown[]: Values in the wanted order. Anything but an array throws a `TypeError`.
- arrayType?: string: Type to cast the array to, e.g. `'uuid[]'`.

## Usage

```typescript
// ids ranked by a search engine
const products = await repository
  .createQueryBuilder('product')
  .whereIsAny('product.id', rankedIds)
  .orderByArrayPosition('product.id', rankedIds)
  .getMany();
```

```typescript
// pinned rows first, then by date
query
  .orderByArrayPosition('post.id', pinnedIds)
  .addOrderBy('post.createdAt', 'DESC')
```

For a typesafe version that takes the column from an entity property, see [orderByArrayPositionTyped](../typed/orderByArrayPositionTyped.md).
