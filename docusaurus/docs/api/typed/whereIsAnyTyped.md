---
sidebar_position: 5.5
---

# whereIsAnyTyped

## Description
`whereIsAnyTyped` adds a typesafe `column = ANY(:array)` condition: the column comes from an entity property instead of a string. It works like [whereIsAny](../where/whereIsAny.md): the whole array is bound as one parameter, and an empty array becomes `FALSE`.

**PostgreSQL only** (and compatible databases such as CockroachDB).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`. On `UpdateQueryBuilder` / `DeleteQueryBuilder` the column isn't prefixed with an alias (`UPDATE "users" … WHERE "firstName" = …`), since UPDATE / DELETE statements have none.

## Signature
```typescript
whereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[]): SelectQueryBuilder<Entity>
andWhereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[]): SelectQueryBuilder<Entity>
orWhereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[]): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity. Selecting several fields throws a `TypeError`.
- array?: readonly unknown[]: Values to compare with. Readonly arrays and `as const` constants are accepted.

## Usage

```typescript
// WHERE "user"."id" = ANY($1)
query.whereIsAnyTyped(user => user.id, ids)
```

```typescript
const ACTIVE_STATUSES = ['active', 'trial'] as const;

query.andWhereIsAnyTyped(user => user.status, ACTIVE_STATUSES)
```

```typescript
// columns of joined relations
// WHERE "images"."url" = ANY($1)
query
  .leftJoinTyped(user => user.images, 'images')
  .whereIsAnyTyped(user => user.images.url, urls)
```
