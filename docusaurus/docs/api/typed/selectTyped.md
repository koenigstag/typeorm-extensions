---
sidebar_position: 2
---

# selectTyped

## Description
`selectTyped` is a method that applies typesafe select to a query, replacing previous selections. `addSelectTyped` adds to them.

## Signature
```typescript
selectTyped(
  selection: KeyProxyCallback<Entity>,
  alias?: string,
  useQuotes?: boolean
): SelectQueryBuilder<Entity>

selectTyped(
  selection: Array<KeyProxyCallback<Entity>>,
  useQuotes?: boolean
): SelectQueryBuilder<Entity>

addSelectTyped(...): SelectQueryBuilder<Entity> // same overloads
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one field, or an array of fields. Can also be an array of callbacks.
- alias?: string: Alias for the selection.
- useQuotes?: boolean: Quote the selected key (`"user"."name"`). Default `false` (`user.name`).

## Usage

```typescript
// same as `query.select('user.name', 'fullName')`
query.selectTyped(user => user.name, 'fullName')
```

```typescript
// same as `query.select(['user.id', 'user.name'])`
query.selectTyped(user => [
  user.id,
  user.name,
])
```

```typescript
// same as `query.select(['user.id', 'images.url'])`
query
  .leftJoinTyped(user => user.images, 'images')
  .selectTyped([
    user => user.id,
    user => user.images.url,
  ])
```

```typescript
// same as `query.addSelect('user.createdAt', 'registeredAt')`
query.addSelectTyped(user => user.createdAt, 'registeredAt')
```

```typescript
// same as `query.select('"user"."name"', 'fullName')`
query.selectTyped(user => user.name, 'fullName', true)
```
