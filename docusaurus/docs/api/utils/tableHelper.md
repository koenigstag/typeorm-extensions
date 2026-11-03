---
sidebar_position: 1
---

# tableHelper

## Description

`tableHelper` builds SQL fragments for an entity: column references, conditions, joins, counts and JSONB accessors. Column names are checked against the entity type, so string parts of a query get the same type safety as typed methods.

```typescript
import { tableHelper } from 'typeorm-extensions';
```

## Signature

```typescript
tableHelper<Entity>(
  alias?: string,
  options?: { useQuotes?: boolean }
)
```

## Arguments

- alias?: string: Alias of the table in the query, e.g. `'user'` for `createQueryBuilder('user')`.
- options.useQuotes?: boolean: Quote identifiers (`"user"."email"`). Default `true`; with `false` they are left as is (`user.email`).

## Methods

All examples use `const t = tableHelper<UserEntity>('user')`.

| Method | Example | Result |
|---|---|---|
| `column(column, alias?)` | `t.column('email')` | `"user"."email"` |
| | `t.column('id', 'u')` | `"u"."id"` |
| `where(column, expression?)` | `t.where('id', '= :id')` | `"user"."id" = :id` |
| `join(relation)` | `t.join('images')` | `user.images` |
| `joinOn(column, expression)` | `t.joinOn('id', '= images.userId')` | `"user"."id" = images.userId` |
| `isNull(column)` | `t.isNull('deletedAt')` | `"user"."deletedAt" IS NULL` |
| `isNotNull(column)` | `t.isNotNull('email')` | `"user"."email" IS NOT NULL` |
| `count(column?, countExpression?)` | `t.count('id')` | `CAST(COUNT("user"."id") AS integer)` |
| | `t.count()` | `CAST(COUNT("user".*) AS integer)` |
| `cast(expression, type)` | `t.cast(t.column('id'), 'text')` | `CAST("user"."id" AS text)` |
| `jsonColumn(column, operator, ...keys)` | `t.jsonColumn('metadata', '->>', 'role')` | `"user"."metadata" ->> 'role'` |
| `jsonPath(column, operator, ...keys)` | `t.jsonPath('metadata', '->>', 'role')` | `->> 'role'` |

Notes:
- Without an alias, `column()` returns just the column (`"email"`) and `count()` counts `*`. `join()` needs an alias.
- `count()` casts the result to `integer`, so drivers that return counts as strings (e.g. `pg`) give a number.
- `countExpression` is appended after the column inside `COUNT(...)`.

## JSONB

`jsonColumn` returns the full accessor for a JSON/JSONB column; `jsonPath` returns only the operator part, for use in [whereTyped](../typed/whereTyped.md) conditions, where the column comes from the callback.

- `operator` is applied to the last key: `->>` returns text, `->` returns JSON. Keys before the last one always use `->`.
- Keys are inferred from the column's TypeScript type (autocomplete up to 4 levels deep). For untyped JSON columns any strings are accepted.
- Keys are escaped as SQL string literals (`o'brien` → `'o''brien'`), so a key can't break out of the literal.

```typescript
type UserMetadata = {
  role: string;
  settings: { theme: string; status: string };
};

const t = tableHelper<UserEntity>('user');

t.jsonColumn('metadata', '->>', 'role')              // "user"."metadata" ->> 'role'
t.jsonColumn('metadata', '->>', 'settings', 'theme') // "user"."metadata" -> 'settings' ->> 'theme'
t.jsonColumn('metadata', '->', 'settings')           // "user"."metadata" -> 'settings'
t.jsonPath('metadata', '->>', 'settings', 'theme')   // -> 'settings' ->> 'theme'
```

## Usage

```typescript
const user = tableHelper<UserEntity>('user');
const image = tableHelper<ImageEntity>('images');

const rows = await dataSource
  .getRepository(UserEntity)
  .createQueryBuilder('user')
  .leftJoin(user.join('images'), 'images', image.isNotNull('url'))
  .select(user.column('id'), 'id')
  .addSelect(image.count('id'), 'imagesCount')
  .where(user.isNotNull('email'))
  .andWhere(`${user.jsonColumn('metadata', '->>', 'role')} = :role`, { role: 'admin' })
  .groupBy(user.column('id'))
  .getRawMany();
```

```typescript
// JSONB condition with whereTyped
query.whereTyped(
  user => user.metadata,
  `${t.jsonPath('metadata', '->>', 'role')} =`,
  'admin',
)
```
