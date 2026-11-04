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

## Signature
```typescript
whereSearchTyped(selectors: Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
andWhereSearchTyped(selectors: Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
orWhereSearchTyped(selectors: Array<KeyProxyCallback<Entity> | { sql: string }>, value: string | null | undefined, options?: TypedSearchOptions): this
```

## Arguments
- selectors: The columns to search in, at least one:
  - a [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md), which may select several columns (`u => [u.firstName, u.lastName]`) or a joined column (`u => u.profile.nickname`);
  - `{ sql: string }`: a raw SQL expression, used as is in parentheses, e.g. the full name below.
- value: string | null | undefined: The text to search for.
- options?: TypedSearchOptions: The options of [whereILikeTyped](./whereILikeTyped.md#arguments) (`match`, `escape`, `unaccent`), plus:
  - minLength?: number: The shortest value that is searched for. Defaults to `1`.

An empty `selectors` array or an invalid selector throws a `TypeError`, even for a blank value.

## Usage

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
