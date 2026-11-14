---
sidebar_position: 6
---

# type ApplyOrderOptions

## Description

`ApplyOrderOptions` is a type that controls order configuration.

## Definition

Defaults: 
- `useQuotes = true`
- `alias = undefined`
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

- `useQuotes`: quote the order expression, e.g. `"user"."createdAt"` instead of `user.createdAt`.
- `alias`: alias to prefix every field with. `OrderParam.tableAlias` takes precedence over it.
- `alwaysAliasFields`: without `alias` / `tableAlias`, only these fields are prefixed with the query's main alias; other fields are used as is (e.g. to order by a selected alias).
- `resetPreviousOrder`: drop ORDER BY clauses set earlier on the query before applying this order.

## Example

```typescript
query
  .applyOrderFilter(
    order,
    { useQuotes: false } // ApplyOrderOptions
  )
  .applyPagination(
    pagination,
    { useTakeAndSkip: true }
  )
```