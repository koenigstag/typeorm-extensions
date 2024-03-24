---
sidebar_position: 4
---

# type ApplyPaginationOptions

## Description

`ApplyPaginationOptions` is a type that controls order configuration.

## Definition

Defaults: `useTakeAndSkip = false`

```typescript
type ApplyPaginationOptions = {
  useTakeAndSkip?: boolean;
};
```

## Example

```typescript
query
  .applyPaginationFilter(
    pagination,
    { useTakeAndSkip: true } // ApplyPaginationOptions
  )
  .applyOrderFilter(
    order,
    { useDoubleQuotes: false }
  )
```