---
sidebar_position: 6
---

# distinctOnTyped

## Description
`distinctOnTyped` is a method that applies typesafe distinctOn to a query in Postgres.

## Signature
```typescript
distinctOnTyped(
  ...distinctOn: KeyProxyCallback<Entity>
): SelectQueryBuilder<Entity>
```

## Arguments
- distinctOn: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The array of callbacks which selects fields of entity for distingt rule.

## Usage

```typescript
// same as `query.distinctOn(['user.name'])`
query.distinctOnTyped(user => user.name)
```

```typescript
// same as `query.distinctOn(['user.id', 'user.name'])`
query.distinctOnTyped(user => [
  user.createdAt,
  user.name,
])
```

```typescript
// same as `query.distinctOn(['user.createdAt', 'user.name'])`
query.distinctOnTyped(
  user => user.createdAt,
  user => user.name
)
```
