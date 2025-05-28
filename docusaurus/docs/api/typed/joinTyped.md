---
sidebar_position: 3
---

# joinTyped

## Description
`joinTyped` is a method that applies typesafe select to a query.

## Signature
```typescript
joinTyped(
  selection: KeyProxyCallback<Entity>,
  alias?: string
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The callback which selects fields of entity.
- alias?: string: Alias for the selection.

## Usage

```typescript
// same as `query.leftJoin('user.subscriptions', 'subscriptions')`
query.leftJoinTyped(user => user.subscriptions, 'subscriptions')
```
