---
sidebar_position: 4
---

# whereArrayContains / ContainedBy / Overlaps

## Description

Conditions on PostgreSQL **array columns** (`text[]`, `int[]`, `uuid[]`, …):

| Method | SQL | True when |
|---|---|---|
| `whereArrayContains` | `column @> :values` | the column has **every** value |
| `whereArrayContainedBy` | `column <@ :values` | every element of the column is one of the values |
| `whereArrayOverlaps` | `column && :values` | the column has **at least one** of the values |

- The values are bound as **one** array parameter, whatever their number.
- The operators can use a GIN index on the column (`CREATE INDEX … USING GIN (tags)`).
- Empty arrays are bound as is and follow PostgreSQL: every array contains `{}` (`@>` matches every non-null column), nothing overlaps `{}` (`&&` matches nothing), and only an empty column is contained by `{}`.
- A `NULL` column never matches.

**PostgreSQL only** (and compatible databases such as CockroachDB). The column must be a real array column, e.g. `@Column('text', { array: true })`, not TypeORM's `simple-array` (comma-separated text).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`).

## Signature

```typescript
whereArrayContains(field: string, values: readonly unknown[], arrayType?: string): this
andWhereArrayContains(field: string, values: readonly unknown[], arrayType?: string): this
orWhereArrayContains(field: string, values: readonly unknown[], arrayType?: string): this

whereArrayContainedBy(field: string, values: readonly unknown[], arrayType?: string): this
andWhereArrayContainedBy(field: string, values: readonly unknown[], arrayType?: string): this
orWhereArrayContainedBy(field: string, values: readonly unknown[], arrayType?: string): this

whereArrayOverlaps(field: string, values: readonly unknown[], arrayType?: string): this
andWhereArrayOverlaps(field: string, values: readonly unknown[], arrayType?: string): this
orWhereArrayOverlaps(field: string, values: readonly unknown[], arrayType?: string): this
```

## Arguments

- field: string: Array column, e.g. `'article.tags'`. It is quoted as an SQL identifier: `"article"."tags"`.
- values: readonly unknown[]: Values to compare with. Required: anything but an array throws a `TypeError` (`@> '{}'` would silently match every row).
- arrayType?: string: Type to cast the parameter to, e.g. `'uuid[]'`: `@> CAST(:param AS uuid[])`. PostgreSQL infers it from the column, so it's usually not needed. Only a type name is accepted, see [whereIsAny](./whereIsAny.md).

## Usage

```typescript
@Entity()
class Article {
  @Column('text', { array: true })
  tags: string[];
}
```

```typescript
// articles tagged with both 'orm' and 'sql'
// WHERE "article"."tags" @> $1, $1 = '{orm,sql}'
query.whereArrayContains('article.tags', ['orm', 'sql'])
```

```typescript
// articles tagged with 'orm' or 'sql'
// WHERE "article"."tags" && $1
query.whereArrayOverlaps('article.tags', ['orm', 'sql'])
```

```typescript
// articles using only allowed tags
// WHERE "article"."tags" <@ $1
query.whereArrayContainedBy('article.tags', ALLOWED_TAGS)
```

```typescript
// WHERE "article"."reviewer_ids" @> CAST($1 AS int[])
query.whereArrayContains('article.reviewer_ids', [userId], 'int[]')
```

To check a **scalar** column against a list of values, use [whereIsAny](./whereIsAny.md) (`column = ANY(:array)`) instead.

For a typesafe version that takes the column from an entity property, see [whereArrayContainsTyped](../typed/whereArrayTyped.md).
