---
sidebar_position: 5.86
---

# whereSearchTyped

## Description
Typesafe search across several columns: one group of [ILIKE](./whereILikeTyped.md) conditions joined with `OR`, all bound to **one** parameter.

```sql
AND ("user"."firstName" ILIKE :p OR "user"."lastName" ILIKE :p OR "user"."email" ILIKE :p)
```

The group is in parentheses, so it combines safely with other conditions. Escaping, trimming and the database syntax are the same as in [whereILikeTyped](./whereILikeTyped.md). A value shorter than `minLength` (after trimming) adds no condition.

### Substring or similar

`similar` adds a [trigram condition](./whereSimilarTyped.md) for each column to the same group (PostgreSQL, `pg_trgm`), so a row matches when a column contains the value **or** is similar to it, typos included:

```sql
AND ("user"."firstName" ILIKE :pattern OR "user"."firstName" % :term OR "user"."lastName" ILIKE :pattern OR "user"."lastName" % :term)
```

Two parameters: the escaped pattern and the trimmed value. `similar: true` uses `%`; an object takes the operator and the score cutoff of [whereSimilarTyped](./whereSimilarTyped.md): `{ operator: '%>', minScore: 0.7 }`, or `{ operator: false, minScore: 0.2 }` for a cutoff below the session threshold (every row is scored then). `unaccent` applies to both conditions, `match` and `escape` to the ILIKE only. `substring: false` leaves the ILIKE conditions out.

With `similar` the method throws a `TypeError` on a database other than PostgreSQL, where `%` is the modulo operator. Without it, it works on every database, as before.

## Signature
```typescript
whereSearchTyped(selectors: KeyProxyCallback<Entity> | Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
andWhereSearchTyped(selectors: KeyProxyCallback<Entity> | Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
orWhereSearchTyped(selectors: KeyProxyCallback<Entity> | Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
```

## Arguments
- selectors: The columns to search in, at least one. One [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md) selecting them, `u => [u.firstName, u.email]`, or an array of:
  - a [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md), which may select several columns (`u => [u.firstName, u.lastName]`) or a joined column (`u => u.profile.nickname`);
  - `{ sql: string }`: a raw SQL expression, used as is in parentheses, e.g. the full name below.
- value: string | null | undefined: The text to search for.
- options?: TypedSearchOptions: The options of [whereILikeTyped](./whereILikeTyped.md#arguments) (`match`, `escape`, `unaccent`), plus:
  - minLength?: number: The shortest value that is searched for. Defaults to `1`.
  - similar?: boolean | object: Also match columns trigram-similar to the value, see above. Defaults to `false`.
  - substring?: boolean: `false` leaves out the ILIKE conditions, so only `similar` matches. Defaults to `true`; `false` without `similar` throws a `TypeError`.

No columns or an invalid selector throws a `TypeError`, even for a blank value.

## Usage

```typescript
// AND ("user"."firstName" ILIKE $1 OR "user"."email" ILIKE $1)
query.andWhereSearchTyped(user => [user.firstName, user.email], dto.search)
```

```typescript
// AND ("user"."firstName" ILIKE $1 OR "user"."lastName" ILIKE $1
//   OR ("user"."firstName" || ' ' || "user"."lastName") ILIKE $1)
query.andWhereSearchTyped(
  [
    user => [user.firstName, user.lastName],
    { sql: `"user"."firstName" || ' ' || "user"."lastName"` },
  ],
  dto.search,
  { minLength: 2 },
)
```

```typescript
// with joins: address the joined alias through an alias-keyed type
type Q = { user: User; club: Club };

query
  .leftJoin('user.club', 'club')
  .andWhereSearchTyped<Q>([q => q.user.email, q => q.club.name], dto.search, { match: 'prefix' })
```

```typescript
// a substring, or similar despite a typo; trigrams only from 3 characters on
// AND ("product"."name" ILIKE $1 OR "product"."name" % $2 OR "product"."sku" ILIKE $1 OR "product"."sku" % $2)
const term = dto.search?.trim() ?? '';

query.andWhereSearchTyped(p => [p.name, p.sku], term, { similar: term.length >= 3 })
```
