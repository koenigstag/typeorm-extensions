---
sidebar_position: 6
---

# whereIsDistinctFrom

## Description

Null-safe comparisons, where `NULL` is a value like any other:

| Method | Standard SQL | True when |
|---|---|---|
| `whereIsDistinctFrom` | `column IS DISTINCT FROM :value` | the column differs from the value |
| `whereIsNotDistinctFrom` | `column IS NOT DISTINCT FROM :value` | the column equals the value |

With `=` and `<>`, a comparison with `NULL` is `NULL`, and the row is dropped: `owner_id <> 1` skips rows without an owner, and `owner_id = NULL` matches nothing. The null-safe versions treat `NULL` as equal to `NULL` and different from everything else:

| column | value | `<>` | `IS DISTINCT FROM` |
|---|---|---|---|
| `1` | `1` | false | false |
| `2` | `1` | true | true |
| `NULL` | `1` | NULL (dropped) | **true** |
| `NULL` | `NULL` | NULL (dropped) | **false** |

`null` and `undefined` values are compared with the `NULL` literal, without a parameter.

Works on every database, in its own syntax:

- PostgreSQL, CockroachDB, SQL Server 2022+ and other drivers: the standard `IS [NOT] DISTINCT FROM`
- MySQL / MariaDB: `NOT (column <=> :value)` / `column <=> :value`
- SQLite: `column IS NOT :value` / `column IS :value`

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`).

## Signature

```typescript
whereIsDistinctFrom(field: string, value: unknown): this
andWhereIsDistinctFrom(field: string, value: unknown): this
orWhereIsDistinctFrom(field: string, value: unknown): this

whereIsNotDistinctFrom(field: string, value: unknown): this
andWhereIsNotDistinctFrom(field: string, value: unknown): this
orWhereIsNotDistinctFrom(field: string, value: unknown): this
```

## Arguments

- field: string: Column to compare, e.g. `'ticket.owner_id'`. It is quoted as an SQL identifier: `"ticket"."owner_id"`.
- value: unknown: Value to compare with; `null` / `undefined` compare with `NULL`.

## Usage

```typescript
// tickets not owned by the user, unassigned ones included
// WHERE "ticket"."owner_id" IS DISTINCT FROM $1
query.whereIsDistinctFrom('ticket.owner_id', userId)
```

```typescript
// `ownerId` may be null: matches unassigned tickets then, instead of nothing
// WHERE "ticket"."owner_id" IS NOT DISTINCT FROM NULL
query.whereIsNotDistinctFrom('ticket.owner_id', filter.ownerId)
```

For a typesafe version that takes the column from an entity property, see [whereIsDistinctFromTyped](../typed/whereIsDistinctFromTyped.md).
