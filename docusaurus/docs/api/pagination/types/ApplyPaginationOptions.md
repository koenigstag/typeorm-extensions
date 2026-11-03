---
sidebar_position: 4
---

# type ApplyPaginationOptions

## Description

`ApplyPaginationOptions` is a type that controls pagination configuration.

## Definition

Defaults: `useTakeAndSkip = false`

```typescript
type ApplyPaginationOptions = {
  useTakeAndSkip?: boolean;
};
```

- `useTakeAndSkip`: when `true`, the page is applied with TypeORM's `take()` / `skip()`; when `false`, with `limit()` / `offset()`. Use `take` / `skip` for queries with joined collections: TypeORM then paginates by entities instead of SQL rows.

## Example

```typescript
query
  .applyPaginationFilter(
    pagination,
    { useTakeAndSkip: true } // ApplyPaginationOptions
  )
  .applyOrderFilter(
    order,
    { useQuotes: false }
  )
```