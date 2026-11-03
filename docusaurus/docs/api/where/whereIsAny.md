---
sidebar_position: 3
---

# whereIsAny

## Description

`whereIsAny` adds a `column = ANY(:array)` condition. Unlike [whereIsIn](./whereIsIn.md), which expands the array into one bind parameter per value (`IN ($1, $2, …)`), the whole array is bound as **one** array parameter.

- Works for any number of values. PostgreSQL allows at most 65535 bind parameters per query, so `IN` with more values fails, e.g. with `bind message has 4464 parameter formats but 0 parameters` for 70 000 values.
- The SQL text is the same for any array length, which helps prepared statements and `pg_stat_statements`.
- An empty (or missing) array becomes `FALSE` (no rows match), like `whereIsIn`.

**PostgreSQL only** (and compatible databases such as CockroachDB): it needs array parameters.

Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`.

## Signature

```typescript
whereIsAny(field: string, array?: readonly unknown[]): this
andWhereIsAny(field: string, array?: readonly unknown[]): this
orWhereIsAny(field: string, array?: readonly unknown[]): this
```

## Arguments

- field: string: Column to compare, e.g. `'user.id'`. It is quoted as an SQL identifier: `"user"."id"`.
- array?: readonly unknown[]: Values to compare with. Readonly arrays and `as const` constants are accepted.

Like TypeORM's `where`, `whereIsAny` replaces previously set WHERE conditions; use `andWhereIsAny` / `orWhereIsAny` to add to them.

## Usage

```typescript
// WHERE "user"."id" = ANY($1), $1 = '{1,2,3}'
query.whereIsAny('user.id', [1, 2, 3])
```

```typescript
// one parameter, whatever the size of `ids`
query.andWhereIsAny('user.id', ids)
```

```typescript
// same as `query.where('FALSE')`: no rows
query.whereIsAny('user.id', [])
```

For a typesafe version that takes the column from an entity property, see [whereIsAnyTyped](../typed/whereIsAnyTyped.md).
