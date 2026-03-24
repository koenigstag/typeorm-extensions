---
sidebar_position: 6
---

# type ApplyOrderOptions

## Description

`ApplyOrderOptions` is a type that controls order configuration.

## Definition

Defaults: 
- `useQuotes = true`
- `alias = query.alias`
- `alwaysAliasFields = ['id', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'deleted_at',  'deletedAt']`
- `resetPreviousOrder = false`

```typescript
type ApplyOrderOptions = {
  useQuotes?: boolean;
  alias?: string;
  alwaysAliasFields?: string[];
  resetPreviousOrder?: boolean;
};
```

## Example

```typescript
query
  .applyOrderFilter(
    order,
    { useQuotes: false } // ApplyOrderOptions
  )
  .applyPaginationFilter(
    pagination,
    { useTakeAndSkip: true }
  )
```