---
sidebar_position: 5
---

# orderByTyped

## Description
`orderByTyped` is a method that applies typesafe order to a query.

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
- selection: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The callback which selects fields of entity.
- order?: 'ASC' | 'DESC': Order direction. Default is 'ASC'.
- nulls?: 'NULLS FIRST' | 'NULLS LAST': NULLS ordering.
- options?: TypedOrderByOptions: `{ useQuotes?: boolean }`. With `useQuotes` the key is the quoted database column (`"user"."updated_at"`) instead of `user.updatedAt`. Replaces the `useDoubleQuotes` argument of 1.3.x.

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
// same as `query.addOrderBy('"user"."name"', 'DESC', 'NULLS LAST')`
query.addOrderByTyped(user => user.name, 'DESC', 'NULLS LAST', { useQuotes: true })
```
