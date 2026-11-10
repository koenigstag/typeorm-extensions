---
sidebar_position: 9
---

# innerJoinUnnest

## Description

Keeps the rows whose column is one of the values of an array, by joining the array as a set of rows:

```sql
INNER JOIN (SELECT DISTINCT unnest(CAST($1 AS uuid[])) AS "value") "unnest_x7k2q"
  ON "user"."id" = "unnest_x7k2q"."value"
```

It returns the same rows as [whereIsAny](./whereIsAny.md) (`"user"."id" = ANY($1)`). The difference is the plan: here the array is a relation, so for a large array the planner can start from it and look the rows up by an index on the column, or hash-join it, instead of testing every row against the array. Compare both with `EXPLAIN` on your data.

- The values are `DISTINCT`: a value repeated in the array doesn't repeat the rows it matches.
- An empty array matches no row (`AND FALSE`), without a parameter.
- The field is resolved like the other extensions: `user.ownerId` joins on `"user"."owner_id"`.
- The array is cast to `arrayType`, by default the array of the column's type (`uuid[]`, `integer[]`, `character varying[]`). It is required when the field is not an entity column, and for an enum column, whose type is named by the database (`'"user_role_enum"[]'`). It is checked to be a type name.

PostgreSQL and CockroachDB.

## Signature

```typescript
innerJoinUnnest(field: string, array: readonly unknown[] | null | undefined, arrayType?: string): this
```

## Arguments

- field: string: The column to match, `alias.property` or `alias.column_name`.
- array: The values. `null`, `undefined` and `[]` match no row.
- arrayType?: string: The array type to cast the parameter to, e.g. `'uuid[]'`.

## Usage

```typescript
// the users among a list of ids
userRepository
  .createQueryBuilder('user')
  .innerJoinUnnest('user.id', userIds)
  .getMany();
```

```typescript
// a column of a joined table, with an explicit type
query
  .innerJoin('event.owner', 'owner')
  .innerJoinUnnest('owner.email', emails, 'text[]');
```
