---
sidebar_position: 6
---

# orderByTyped

## Description
`orderByTyped` is a method that applies typesafe order to a query. `addOrderByTyped` adds an order to the existing ones.

## Signature
```typescript
orderByTyped(
  selection: KeyProxyCallback<Entity>,
  order?: 'ASC' | 'DESC',
  nulls?: 'NULLS FIRST' | 'NULLS LAST',
  options?: TypedOrderByOptions
): SelectQueryBuilder<Entity>

addOrderByTyped(
  selection: KeyProxyCallback<Entity>,
  order?: 'ASC' | 'DESC',
  nulls?: 'NULLS FIRST' | 'NULLS LAST',
  options?: TypedOrderByOptions
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects fields of entity.
- order?: 'ASC' | 'DESC': Order direction. Default is 'ASC'.
- nulls?: 'NULLS FIRST' | 'NULLS LAST': NULLS ordering.
- options?: `TypedOrderByOptions`: `{ useQuotes?: boolean }`. With `useQuotes: true` the key is quoted (`"user"."name"`). Default `false` (`user.name`).

## Usage

```typescript
// same as `query.orderBy('user.updatedAt', 'DESC')`
query.orderByTyped(user => user.updatedAt, 'DESC')
```

```typescript
// same as `query.addOrderBy('user.name', 'ASC')`
query.addOrderByTyped(user => user.name, 'ASC')
```

```typescript
// columns of joined relations, including array relations
// same as `query.orderBy('images.url', 'ASC', 'NULLS LAST')`
query
  .leftJoinTyped(user => user.images, 'images')
  .orderByTyped(user => user.images.url, 'ASC', 'NULLS LAST')
```

```typescript
// same as `query.addOrderBy('"user"."name"', 'ASC')`
query.addOrderByTyped(user => user.name, 'ASC', undefined, { useQuotes: true })
```
