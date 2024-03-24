---
sidebar_position: 3
---

# Order

This category provides a set of examples for order features.

## applyOrderFilter

`applyOrderFilter` is a method that applies pagination to a query.

[API reference](/docs/api/order/applyOrderFilter)

```typescript
query
  .applyOrderFilter(
    {
      orderBy: [
        { field: 'createdAt', direction: 'asc', nulls: 'last' }
      ]
    },
    { useDoubleQuotes: true }
  )
```
