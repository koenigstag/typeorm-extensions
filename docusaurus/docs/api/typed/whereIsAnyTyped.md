---
sidebar_position: 5.5
---

# whereIsAnyTyped

## Description
`whereIsAnyTyped` adds a typesafe `column = ANY(:array)` condition: the column comes from an entity property instead of a string. It works like [whereIsAny](../where/whereIsAny.md): the whole array is bound as one parameter, and an empty array becomes `FALSE`.

**PostgreSQL only** (and compatible databases such as CockroachDB).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`). On `UpdateQueryBuilder` / `DeleteQueryBuilder` / `SoftDeleteQueryBuilder` the column isn't prefixed with an alias (`UPDATE "users" … WHERE "firstName" = …`), since UPDATE / DELETE statements have none.

## Signature
```typescript
whereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>
andWhereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>
orWhereIsAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>

whereIsNotAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>
andWhereIsNotAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>
orWhereIsNotAnyTyped(selection: KeyProxyCallback<Entity>, array?: readonly unknown[], arrayType?: string): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity. Selecting several fields throws a `TypeError`.
- array?: readonly unknown[]: Values to compare with. Readonly arrays and `as const` constants are accepted.
- arrayType?: string: Type to cast the array parameter to, e.g. `'uuid[]'`: `= ANY(CAST(:param AS uuid[]))`. See [whereIsAny](../where/whereIsAny.md).

With the [`strictParams`](./whereTyped.md#checking-parameters-strictparams) option the array has to hold values of the column's type (`whereIsAnyTyped(u => u.id, ['a'])` doesn't compile for a `number` column).

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

```typescript
// WHERE "user"."id" = ANY(CAST($1 AS uuid[]))
query.whereIsAnyTyped(user => user.id, ids, 'uuid[]')
```

```typescript
// NOT: the column differs from every value — `<> ALL`, see whereIsAny › whereIsNotAny
// WHERE "user"."status" <> ALL($1)
query.whereIsNotAnyTyped(user => user.status, ['banned', 'deleted'])
```
