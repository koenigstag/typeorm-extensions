---
sidebar_position: 4
---

# whereTyped

## Description
`whereTyped` is a method that applies typesafe condition to a query.

## Signature
```typescript
whereTyped(
  selection: KeyProxyCallback<Entity>,
  condition?: string,
  params?: unknown
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback): The callback which selects fields of entity.
- condition?: string: Condition query with operator and value.
- params?: Record &lt;string, unknown&gt;: Parameters for the condition.

## Usage

```typescript
// same as `query.where('user.name LIKE :name', { name: '%John%' })`
query
  .whereTyped(
    user => user.name,
    'LIKE',
    { name: '%John%' },
  )
```

```typescript
// same as `query.andWhere('user.name LIKE :name', { name: '%Doe%' })`
query
  .andWhereTyped(
    user => user.name,
    'LIKE',
    '%Doe%',
  )
```

```typescript
// same as `query.orWhere('user.name LIKE :name', { name: '%John Doe%' })`
query
  .orWhereTyped(
    user => user.name,
    'LIKE',
    '%John Doe%',
  )
```
