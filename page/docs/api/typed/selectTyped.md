---
sidebar_position: 2
---

# selectTyped

## Description
`selectTyped` is a method that applies typesafe select to a query.

## Signature
```typescript
selectTyped(
  selection: KeyProxyCallback<Entity>,
  alias?: string
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The callback which selects fields of entity.
- alias?: string: Alias for the selection

## Usage

```typescript
// same as `query.select('user.name', 'fullName')`
query.selectTyped(user => user.name, 'fullName')
```

```typescript
// same as `query.select(['id', 'name'])`
query.selectTyped(user => [
  user.id,
  user.name,
])
```

```typescript
// same as `query.addSelect('user.createdAt', 'registeredAt')`
query.addSelectTyped(user => user.createdAt, 'registeredAt')
```
