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

```typescript
// before from(): address the column by its alias, the query has no main alias yet
// same as `dataSource.createQueryBuilder().select('base.chatRoomId').from(ChatMessage, 'base')`
dataSource
  .createQueryBuilder()
  .selectTyped<{ base: ChatMessage }>((q) => q.base.chatRoomId)
  .from(ChatMessage, 'base')
```

See [KeyProxyCallback](./types/KeyProxyCallback.md#before-from) for keys before `from()`.
