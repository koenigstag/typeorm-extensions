---
sidebar_position: 3
---

# joinTyped

## Description
`joinTyped` methods apply typesafe joins of entity relations to a query: `leftJoinTyped`, `innerJoinTyped`, `leftJoinAndSelectTyped` and `innerJoinAndSelectTyped`. The callback may only select relation properties.

## Signature
```typescript
leftJoinTyped(
  selection: (proxy: Entity) => relation,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
): SelectQueryBuilder<Entity>

innerJoinTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
leftJoinAndSelectTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
innerJoinAndSelectTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects a relation of entity.
- alias: string: Alias of the joined relation. Use the relation's property name (e.g. `'images'` for `user.images`) to reference its columns with typed methods as `user => user.images.url`. For any other alias, type the callbacks by the query's aliases, see [Typing joined aliases](./types/KeyProxyCallback.md#typing-joined-aliases).
- condition?: string: Additional join condition.
- parameters?: ObjectLiteral: Parameters for the condition.

## Usage

```typescript
// same as `query.leftJoin('user.subscriptions', 'subscriptions')`
query.leftJoinTyped(user => user.subscriptions, 'subscriptions')
```

```typescript
// same as `query.innerJoinAndSelect('user.images', 'images', 'images.url IS NOT NULL')`
query.innerJoinAndSelectTyped(user => user.images, 'images', 'images.url IS NOT NULL')
```
