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
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects fields of entity. A path into a JSON column (`user => user.metadata.role`) throws a `TypeError`: for a JSON value use [tableHelper](../utils/tableHelper.md#jsonb) `jsonColumn`.
- order?: 'ASC' | 'DESC': Order direction. Default is 'ASC'.
- nulls?: 'NULLS FIRST' | 'NULLS LAST': NULLS ordering.
- options?: `TypedOrderByOptions`: `{ useQuotes?: boolean }`. With `useQuotes: true` the key is the quoted database column (`"user"."updated_at"`, `@Column({ name })` applied) instead of `user.updatedAt`. Default `false`: `user.updatedAt`, which TypeORM maps to the column itself. Replaces the `useDoubleQuotes` argument of 1.3.x.

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
// same as `query.addOrderBy('"user"."name"', 'DESC', 'NULLS LAST')`
query.addOrderByTyped(user => user.name, 'DESC', 'NULLS LAST', { useQuotes: true })
```
