---
sidebar_position: 5
---

# whereIsInTyped

## Description
`whereIsInTyped` and `whereIsNotInTyped` add typesafe `IN` / `NOT IN` conditions: the column comes from an entity property instead of a string. They work like [whereIsIn](../where/whereIsIn.md), including the empty array handling (`IN` → `FALSE`, `NOT IN` → `TRUE`).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`.

## Signature
```typescript
whereIsInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>
andWhereIsInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>
orWhereIsInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>

whereIsNotInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>
andWhereIsNotInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>
orWhereIsNotInTyped(selection: KeyProxyCallback<Entity>, array?: unknown[]): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects the field of entity.
- array?: unknown[]: Values to compare with.

## Usage

```typescript
// same as `query.where('user.id IN (:...ids)', { ids: [1, 2, 3] })`
query.whereIsInTyped(user => user.id, [1, 2, 3])
```

```typescript
// same as `query.andWhere('user.email NOT IN (:...emails)', { emails })`
query.andWhereIsNotInTyped(user => user.email, emails)
```

```typescript
// columns of joined relations
// same as `query.andWhere('images.url IN (:...urls)', { urls })`
query
  .leftJoinTyped(user => user.images, 'images')
  .andWhereIsInTyped(user => user.images.url, urls)
```

```typescript
// same as `query.where('FALSE')`: no rows
query.whereIsInTyped(user => user.id, [])
```
