---
sidebar_position: 2
---

# Pagination

This category provides a set of examples for pagination features.

## applyPagination

`applyPagination` is a method that applies pagination to a query.

[API reference](/docs/api/pagination/applyPagination)

```typescript
query
  .applyPagination(
    { page: 1, pageSize: 10 },
    { useTakeAndSkip: true }
  )
```
