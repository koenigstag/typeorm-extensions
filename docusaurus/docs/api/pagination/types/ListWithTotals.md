---
sidebar_position: 6
---

# interface ListWithTotals

## Description

`ListWithTotals<Entity>` is the result of [getManyWithTotals](../getManyWithTotals.md).

## Definition

```typescript
interface ListWithTotals<Entity> {
  list: Entity[];
  total: number | null;
  limit: number | null;
  offset: number | null;
  hasMore: boolean | null;
  orderBy: OrderType[];
}
```

- `list`: entities of the requested page (or all of them with `loadAll`).
- `total`: number of all rows matching the query, or `null` with `disableTotalsCalculation`.
- `limit`: page size that was applied, or `null` with `loadAll`.
- `offset`: number of skipped rows, or `null` with `loadAll`.
- `hasMore`: whether rows follow the page (`offset + list.length < total`), or `null` when the total or the offset is unknown — with `loadAll` or `disableTotalsCalculation`. [getManyWithCursor](../getManyWithCursor.md) always knows it.
- `orderBy`: the ORDER BY clauses the query was built with, in the order they were applied; empty when the query sets no explicit order.

## Example

```typescript
const result: ListWithTotals<UserEntity> = await query.getManyWithTotals({ page: 3, pageSize: 10 });

const pagesCount = result.total === null ? undefined : Math.ceil(result.total / 10);

// `hasMore` saves comparing the total yourself, and the applied order comes back for the response
if (result.hasMore) {
  // … render a "load more" control
}
```
