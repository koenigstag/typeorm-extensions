---
sidebar_position: 5.7
---

# whereJsonContainsTyped / whereJsonHasKeyTyped

## Description
Typesafe conditions on PostgreSQL `jsonb` / `json` columns: the column comes from an entity property instead of a string. They work like [whereJsonContains / whereJsonHasKey](../where/whereJson.md): `@>` and `?` on the column cast to `jsonb`, which still uses a GIN index on `jsonb` columns.

The property is mapped to its database column (`@Column({ name })`), and on `UpdateQueryBuilder` / `DeleteQueryBuilder` / `SoftDeleteQueryBuilder` the column is not prefixed with an alias. The callback may go into the column to check a nested object: `user => user.metadata.settings` is `"user"."metadata" -> 'settings'` (see [Paths into JSON columns](./whereTyped.md#paths-into-json-columns)).

**PostgreSQL only** (and compatible databases such as CockroachDB).

## Signature
```typescript
whereJsonContainsTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
andWhereJsonContainsTyped(selection: KeyProxyCallback<Entity>, value: unknown): this
orWhereJsonContainsTyped(selection: KeyProxyCallback<Entity>, value: unknown): this

whereJsonHasKeyTyped(selection: KeyProxyCallback<Entity>, key: string): this
andWhereJsonHasKeyTyped(selection: KeyProxyCallback<Entity>, key: string): this
orWhereJsonHasKeyTyped(selection: KeyProxyCallback<Entity>, key: string): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** JSON property, e.g. `user => user.metadata`, or an object inside it, e.g. `user => user.metadata.settings`. Selecting several throws a `TypeError`.
- value: unknown: Part of the document to look for, serialized with `JSON.stringify`.
- key: string: Key to look for at the top level of the selected object.

## Usage

```typescript
// WHERE CAST("user"."metadata" AS jsonb) @> CAST($1 AS jsonb), $1 = '{"role":"admin"}'
query.whereJsonContainsTyped(user => user.metadata, { role: 'admin' })
```

```typescript
// WHERE CAST("user"."metadata" AS jsonb) ? $1
query.andWhereJsonHasKeyTyped(user => user.metadata, 'settings')
```

```typescript
// WHERE CAST("user"."metadata" -> 'settings' AS jsonb) ? $1
query.andWhereJsonHasKeyTyped(user => user.metadata.settings, 'theme')
```
