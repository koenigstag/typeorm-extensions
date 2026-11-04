---
sidebar_position: 1
---

# type KeyProxyCallback

## Description
The callback typed methods take to pick a column: `(proxy) => proxy.column` or `(proxy) => proxy.alias.column`. It reads property names, not values, so a key is at most two levels deep.

```typescript
type KeyProxyCallback<T> = (proxy: DeepUnwrapArray<T>) => ProxyColumnValueType | ProxyColumnValueType[]
```

- `(user) => user.firstName`: a column of the main alias, `"user"."firstName"`.
- `(user) => user.images.url`: a column of the joined alias `images`, `"images"."url"`.
- `(q) => q.base.chatRoomId` with an alias-keyed type `{ base: ChatMessage }`: a column of the alias `base`.
- `(user) => [user.id, user.email]`: several columns, where the method accepts them.

The property is mapped to its database column (`@Column({ name })`, embedded columns) through the metadata of its alias.

## Before `from()`

A query created without an entity (`dataSource.createQueryBuilder()`, `manager.createQueryBuilder()`, `qb.subQuery()`) has no main alias until `from()`. Address columns by their alias there: `alias.column` keys don't need the main alias.

```typescript
type Base = { base: ChatMessage };

// SELECT "base"."chatRoomId" FROM "chat_messages" "base"
dataSource
  .createQueryBuilder()
  .selectTyped<Base>((q) => q.base.chatRoomId)
  .from(ChatMessage, 'base')
```

```typescript
query.where((qb) => {
  const subQuery = qb
    .subQuery()
    .selectTyped<{ m: ChatMessage }>((q) => q.m.chatRoomId)
    .from(ChatMessage, 'm')
    .getQuery();

  return `"room"."id" IN ${subQuery}`;
})
```

A single-level key (`(q) => q.chatRoomId`) needs the main alias, so before `from()` it throws a `TypeError`. Column names are mapped through aliases the query already knows: a quoted key (where methods, `useQuotes`) for a renamed column needs `from()` to come first.
