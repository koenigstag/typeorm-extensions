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
- `includeOrderBy = false`

```typescript
type GetManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
  includeOrderBy?: boolean;
};
```

- `disableTotalsCalculation`: skip the `getCount()` query; `total` is returned as `null`. The page query then asks for `pageSize + 1` rows, so `hasMore` is still known; the extra row is dropped from `list`.
- `loadAll`: load all matching rows without applying pagination; `limit` and `offset` are returned as `null`.
- `includeOrderBy`: add `orderBy` to the result, the SQL order the page was read in, for logs and debugging. Off by default, so a result passed on as an API response doesn't carry SQL.

## Example

```typescript
const { list, total } = await query.getManyWithTotals(
  { page: 1, pageSize: 50 },
  { disableTotalsCalculation: true } // GetManyWithTotalsOptions
);
```
