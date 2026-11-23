---
sidebar_position: 6
---

# type ApplyOrderOptions

## Description

`ApplyOrderOptions` is a type that controls order configuration.

## Definition

Defaults: 
- `useQuotes = undefined`
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

- `useQuotes`: how the field reaches the ORDER BY.
  - Not set: an entity property under an alias with an entity is written `user.createdAt`, which TypeORM maps to its column and which `take` / `skip` with joins can order by; anything else is quoted as one identifier with its database column name, `"user"."created_at"`, `"total"`.
  - `true`: always quoted, `"user"."created_at"`.
  - `false`: written as is, `user.createdAt`. Only column names are accepted then: anything else throws a `TypeError`, since an order often comes from a request.
- `alias`: alias to prefix every field with. `OrderParam.tableAlias` takes precedence over it.
- `alwaysAliasFields`: without `alias` / `tableAlias`, only these fields are prefixed with the query's main alias; other fields are used as is (e.g. to order by a selected alias).
- `resetPreviousOrder`: drop ORDER BY clauses set earlier on the query before applying this order.

## Example

```typescript
query
  .leftJoinAndSelect('user.images', 'images')
  .applyOrderFilter(
    order,
    { alias: 'user', resetPreviousOrder: true } // ApplyOrderOptions
  )
  .applyPagination(
    pagination,
    { useTakeAndSkip: true }
  )
```