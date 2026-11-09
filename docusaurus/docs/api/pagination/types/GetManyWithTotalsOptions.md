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

- `disableTotalsCalculation`: skip the `getCount()` query; `total` is returned as `null`. The page query then asks for `pageSize + 1` rows, so `hasMore` is still known; the extra row is dropped from `list`.
- `loadAll`: load all matching rows without applying pagination; `limit` and `offset` are returned as `null`.

## Example

```typescript
const { list, total } = await query.getManyWithTotals(
  { page: 1, pageSize: 50 },
  { disableTotalsCalculation: true } // GetManyWithTotalsOptions
);
```
