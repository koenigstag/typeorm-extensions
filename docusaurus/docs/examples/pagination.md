---
sidebar_position: 2
---

# Pagination

This category provides a set of examples for pagination features.

## applyPaginationFilter

`applyPaginationFilter` is a method that applies pagination to a query.

[API reference](/docs/api/pagination/applyPaginationFilter)

```typescript
query
  .applyPaginationFilter(
    { page: 1, pageSize: 10 },
    { useTakeAndSkip: true }
  )
```
