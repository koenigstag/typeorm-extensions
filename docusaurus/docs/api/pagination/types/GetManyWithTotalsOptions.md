---
sidebar_position: 5
---

# type GetManyWithTotalsOptions

## Description

`GetManyWithTotalsOptions` is a type that controls [getManyWithTotals](../getManyWithTotals.md).

## Definition

Defaults:
- `disableTotalsCalculation = false`
- `loadAll = false`

```typescript
type GetManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};
```

- `disableTotalsCalculation`: skip the `getCount()` query; `total` is returned as `null`.
- `loadAll`: load all matching rows without applying pagination; `limit` and `offset` are returned as `null`.

## Example

```typescript
const { list, total } = await query.getManyWithTotals(
  { page: 1, pageSize: 50 },
  { disableTotalsCalculation: true } // GetManyWithTotalsOptions
);
```
