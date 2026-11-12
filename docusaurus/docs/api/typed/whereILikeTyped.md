---
sidebar_position: 5.85
---

# whereILikeTyped

## Description
Typesafe case-insensitive pattern search on one column: `"user"."email" ILIKE :pattern`.

- `%`, `_` and `\` in the value are escaped by default, so a user typing `50%` doesn't get a wildcard.
- The value is trimmed. `null`, `undefined` or a blank value adds **no condition**, and previous conditions stay as they are. This lets you pass an optional search field straight through.
- It is `ILIKE`, not `LOWER(col) LIKE`, so a `gin_trgm_ops` index on the column can be used.

| Database | SQL |
|---|---|
| PostgreSQL | `col ILIKE :p` |
| MySQL / MariaDB | `col LIKE :p` (case-insensitive with the default `_ci` collations) |
| SQLite | `col LIKE :p ESCAPE '\'` (case-insensitive for ASCII) |

The property is mapped to its database column (`@Column({ name })`). On `UpdateQueryBuilder` / `DeleteQueryBuilder` / `SoftDeleteQueryBuilder` the column is not prefixed with an alias.

## Signature
```typescript
whereILikeTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedILikeOptions): this
andWhereILikeTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedILikeOptions): this
orWhereILikeTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedILikeOptions): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity. Selecting several throws a `TypeError`; use [whereSearchTyped](./whereSearchTyped.md) for several columns.
- value: string | null | undefined: The text to search for.
- options?: TypedILikeOptions:
  - match?: `'contains'` (default, `%value%`), `'prefix'` (`value%`), `'suffix'` (`%value`) or `'exact'` (`value`).
  - escape?: boolean: Escape `%`, `_` and `\` in the value. Defaults to `true`; `false` keeps the value's own wildcards.
  - unaccent?: boolean | string: Compare without accents: `unaccent(col) ILIKE unaccent(:p)` (PostgreSQL `unaccent` extension). A string names the function to call instead, e.g. an IMMUTABLE wrapper that an expression index is built on: `'immutable_unaccent'`.

## Usage

```typescript
// WHERE "user"."email" ILIKE $1, $1 = '%john%'
query.whereILikeTyped(user => user.email, dto.search)
```

```typescript
// AND "user"."nickname" ILIKE $1, $1 = 'john\_%' (`_` matches itself)
query.andWhereILikeTyped(user => user.nickname, 'john_', { match: 'prefix' })
```

```typescript
// AND immutable_unaccent("city"."name") ILIKE immutable_unaccent($1)
query.andWhereILikeTyped(city => city.name, 'sao paulo', { unaccent: 'immutable_unaccent' })
```

## escapeLikePattern

The escaping is exported as `escapeLikePattern` from `typeorm-extensions` and from the side-effect-free `typeorm-extensions/helpers`. Use it for LIKE conditions written by hand:

```typescript
import { escapeLikePattern } from 'typeorm-extensions/helpers';

// PostgreSQL / MySQL escape with `\` by default; SQLite needs `ESCAPE '\'`
query.andWhere('"u"."email" ILIKE :search', { search: `%${escapeLikePattern(search)}%` })
```
