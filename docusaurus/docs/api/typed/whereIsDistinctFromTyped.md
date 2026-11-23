---
sidebar_position: 5.8
---

# whereIsDistinctFromTyped

## Description
Typesafe null-safe comparisons: the column comes from an entity property instead of a string. They work like [whereIsDistinctFrom / whereIsNotDistinctFrom](../where/whereIsDistinctFrom.md): `NULL` equals `NULL` and differs from any other value, in the syntax of the database (`IS [NOT] DISTINCT FROM`, `<=>` on MySQL / MariaDB, `IS [NOT]` on SQLite).

The property is mapped to its database column (`@Column({ name })`), and on `UpdateQueryBuilder` / `DeleteQueryBuilder` / `SoftDeleteQueryBuilder` the column is not prefixed with an alias.

## Signature
```typescript
whereIsDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
andWhereIsDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
orWhereIsDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this

whereIsNotDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
andWhereIsNotDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
orWhereIsNotDistinctFromTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity. Selecting several throws a `TypeError`.
- value: unknown: Value to compare with; `null` / `undefined` compare with `NULL`.

## Usage

```typescript
// tickets not owned by the user, unassigned ones included
// WHERE "ticket"."owner_id" IS DISTINCT FROM $1
query.whereIsDistinctFromTyped(ticket => ticket.ownerId, userId)
```

```typescript
// UPDATE "tickets" SET … WHERE "owner_id" IS NOT DISTINCT FROM NULL
repository
  .createQueryBuilder()
  .update()
  .set({ status: 'unassigned' })
  .whereIsNotDistinctFromTyped(ticket => ticket.ownerId, null)
  .execute()
```
