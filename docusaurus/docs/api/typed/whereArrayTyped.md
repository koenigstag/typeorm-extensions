---
sidebar_position: 5.6
---

# whereArrayContainsTyped / ContainedByTyped / OverlapsTyped

## Description
Typesafe conditions on PostgreSQL array columns: the column comes from an entity property instead of a string. They work like [whereArrayContains / ContainedBy / Overlaps](../where/whereArray.md): `@>`, `<@` and `&&` with the values bound as one array parameter.

The property is mapped to its database column (`@Column({ name })`), and on `UpdateQueryBuilder` / `DeleteQueryBuilder` the column is not prefixed with an alias.

**PostgreSQL only** (and compatible databases such as CockroachDB).

## Signature
```typescript
whereArrayContainsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
andWhereArrayContainsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
orWhereArrayContainsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this

whereArrayContainedByTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
andWhereArrayContainedByTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
orWhereArrayContainedByTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this

whereArrayOverlapsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
andWhereArrayOverlapsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
orWhereArrayOverlapsTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** array property. Selecting several throws a `TypeError`.
- values: readonly unknown[]: Values to compare with. Anything but an array throws a `TypeError`.
- arrayType?: string: Type to cast the parameter to, e.g. `'int[]'`. See [whereIsAny](../where/whereIsAny.md).

## Usage

```typescript
// WHERE "article"."tags" @> $1
query.whereArrayContainsTyped(article => article.tags, ['orm', 'sql'])
```

```typescript
// @Column('integer', { array: true, name: 'reviewer_ids' }) reviewerIds: number[];
// WHERE "article"."reviewer_ids" && $1
query.andWhereArrayOverlapsTyped(article => article.reviewerIds, [userId])
```

```typescript
// DELETE FROM "articles" WHERE "tags" <@ $1
repository
  .createQueryBuilder()
  .delete()
  .whereArrayContainedByTyped(article => article.tags, OBSOLETE_TAGS)
  .execute()
```
