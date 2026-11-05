---
sidebar_position: 7
---

# distinctOnTyped

## Description
`distinctOnTyped` is a method that applies typesafe distinctOn to a query in Postgres.

## Signature
```typescript
distinctOnTyped(
  ...distinctOn: Array<KeyProxyCallback<Entity>>
): SelectQueryBuilder<Entity>
```

## Arguments
- distinctOn: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callbacks which select fields of entity for the DISTINCT ON rule. PostgreSQL only.

## Usage

```typescript
// same as `query.distinctOn(['user.name'])`
query.distinctOnTyped(user => user.name)
```

```typescript
// same as `query.distinctOn(['user.createdAt', 'user.name'])`
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
