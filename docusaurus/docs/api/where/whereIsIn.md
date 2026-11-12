---
sidebar_position: 2
---

# whereIsIn

## Description

`whereIsIn` and `whereIsNotIn` add `IN` / `NOT IN` conditions with a uniquely named array parameter, so several of them can be combined in one query without parameter name clashes.

An empty (or missing) array doesn't produce invalid SQL like `IN ()`:
- `IN` with an empty array becomes `FALSE` (no rows match);
- `NOT IN` with an empty array becomes `TRUE` (the condition doesn't filter anything).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`).

## Signature

```typescript
whereIsIn(field: string, array?: readonly unknown[]): this
andWhereIsIn(field: string, array?: readonly unknown[]): this
orWhereIsIn(field: string, array?: readonly unknown[]): this

whereIsNotIn(field: string, array?: readonly unknown[]): this
andWhereIsNotIn(field: string, array?: readonly unknown[]): this
orWhereIsNotIn(field: string, array?: readonly unknown[]): this
```

## Arguments

- field: string: Column to compare, e.g. `'user.id'`, which is quoted as an SQL identifier: `"user"."id"` (already quoted parts are kept). An expression such as `LOWER(u.email)`, `COALESCE(a."x", b."x")` or `u.id::text` is used as is.
- array?: readonly unknown[]: Values to compare with. Readonly arrays and `as const` constants are accepted.

Like TypeORM's `where`, `whereIsIn` / `whereIsNotIn` replace previously set WHERE conditions; use the `and` / `or` variants to add to them.

## Usage

```typescript
// same as `query.where('"user"."id" IN (:...ids)', { ids: [1, 2, 3] })`
query.whereIsIn('user.id', [1, 2, 3])
```

```typescript
// same as `query.andWhere('"user"."status" NOT IN (:...statuses)', { statuses: ['banned'] })`
query.andWhereIsNotIn('user.status', ['banned'])
```

```typescript
// expressions are used as is
// same as `query.where('LOWER(u.email) IN (:...emails)', { emails })`
query.whereIsIn('LOWER(u.email)', emails)
```

```typescript
// same as `query.where('FALSE')`: no rows
query.whereIsIn('user.id', [])
```
