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
- distinctOn: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callbacks which select fields of entity for the DISTINCT ON rule. PostgreSQL only. A path into a JSON column (`user => user.metadata.role`) throws a `TypeError`: for a JSON value use [tableHelper](../utils/tableHelper.md#jsonb) `jsonColumn`. A [@CalculatedColumn](../columns/calculatedColumn.md#ordering) selected with `addSelectCalculated` goes in under the alias `orderByCalculated` orders it by, as DISTINCT ON has to match the leading ORDER BY; one not selected yet throws a `TypeError`.

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
