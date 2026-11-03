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
}
```

- `list`: entities of the requested page (or all of them with `loadAll`).
- `total`: number of all rows matching the query, or `null` with `disableTotalsCalculation`.
- `limit`: page size that was applied, or `null` with `loadAll`.
- `offset`: number of skipped rows, or `null` with `loadAll`.

## Example

```typescript
const result: ListWithTotals<UserEntity> = await query.getManyWithTotals({ page: 3, pageSize: 10 });

const pagesCount = result.total === null ? undefined : Math.ceil(result.total / 10);
```
