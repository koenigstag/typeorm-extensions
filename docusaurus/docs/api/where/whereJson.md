---
sidebar_position: 5
---

# whereJsonContains / whereJsonHasKey

## Description

Conditions on PostgreSQL **JSON columns**:

| Method | SQL | True when |
|---|---|---|
| `whereJsonContains` | `CAST(column AS jsonb) @> CAST(:value AS jsonb)` | the document contains `value` |
| `whereJsonHasKey` | `CAST(column AS jsonb) ? :key` | the object has the top-level key (or the array has the string element) |

- "Contains" is PostgreSQL's `@>`: `{ "role": "admin" }` is contained in `{ "role": "admin", "age": 30 }`, nested objects are matched partially too, and `["a"]` is contained in `["a", "b"]`.
- `value` is serialized with `JSON.stringify`; `undefined` (or a function) throws a `TypeError`.
- Works with `jsonb`, `json` and `simple-json` columns: the column is cast to `jsonb`. For a `jsonb` column the cast is a no-op that PostgreSQL drops, so a GIN index (`CREATE INDEX … USING GIN (meta)`) is still used. A `json` column can't have such an index.
- `whereJsonHasKey` uses the `?` operator, not the `jsonb_exists()` function: only the operator can use the index.

**PostgreSQL only** (and compatible databases such as CockroachDB). TypeORM's `simple-json` columns (JSON stored as text) work too, as the cast parses the text, but without an index.

Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`.

## Signature

```typescript
whereJsonContains(field: string, value: unknown): this
andWhereJsonContains(field: string, value: unknown): this
orWhereJsonContains(field: string, value: unknown): this

whereJsonHasKey(field: string, key: string): this
andWhereJsonHasKey(field: string, key: string): this
orWhereJsonHasKey(field: string, key: string): this
```

## Arguments

- field: string: JSON column, e.g. `'user.metadata'` (quoted as `"user"."metadata"`), or a JSON expression such as `tableHelper('user').jsonColumn('metadata', '->', 'settings')`, which is used as is.
- value: unknown: Part of the document to look for: an object, an array, or a scalar.
- key: string: Top-level key to look for.

## Usage

```typescript
// WHERE CAST("user"."metadata" AS jsonb) @> CAST($1 AS jsonb), $1 = '{"role":"admin"}'
query.whereJsonContains('user.metadata', { role: 'admin' })
```

```typescript
// nested objects and arrays are matched partially
query.whereJsonContains('user.metadata', { settings: { theme: 'dark' } })
query.whereJsonContains('article.meta', { flags: ['featured'] })
```

```typescript
// WHERE CAST("user"."metadata" AS jsonb) ? $1, $1 = 'settings'
query.whereJsonHasKey('user.metadata', 'settings')
```

```typescript
// a key of a nested object: pass a JSON expression as the field
// WHERE CAST("user"."metadata" -> 'settings' AS jsonb) ? $1
const u = tableHelper<UserEntity>('user');

query.whereJsonHasKey(u.jsonColumn('metadata', '->', 'settings'), 'theme')
```

For a typesafe version that takes the column from an entity property, see [whereJsonContainsTyped](../typed/whereJsonTyped.md).
