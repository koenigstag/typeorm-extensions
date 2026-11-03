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

All examples use `const t = tableHelper<UserEntity>('user')` and `const image = tableHelper<ImageEntity>('images')`.

| Method | Example | Result |
|---|---|---|
| `column(column, alias?)` | `t.column('email')` | `"user"."email"` |
| | `t.column('id', 'u')` | `"u"."id"` |
| `where(column, expression?)` | `t.where('id', '= :id')` | `"user"."id" = :id` |
| `join(relation)` | `t.join('images')` | `user.images` |
| `joinOn(column, expression)` | `t.joinOn('id', '= ' + image.column('userId'))` | `"user"."id" = "images"."userId"` |
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
- `column()` returns a quoted expression, so `select(t.column('id'), 'id')` keeps its position in the select list, unlike `select('user.id')`, which TypeORM moves into entity column order. See [selectTyped › Column order](../typed/selectTyped.md#column-order).
- `expression` in `where()` / `joinOn()` is inserted as is. Build the columns in it with `tableHelper` too, see [Composing helpers](#composing-helpers).

## Composing helpers

`where()` and `joinOn()` take the rest of the condition as a plain string and insert it as is. When that string references a column of another table, build the column with that table's helper instead of typing it by hand: it is checked against the entity type and quoted.

This matters for camelCase columns. TypeORM rewrites an unquoted `alias.property` only for aliases of entities it knows. For a subquery or raw table join, `img.userId` reaches the database unchanged and PostgreSQL folds it to `img.userid`, which doesn't exist. `"img"."userId"` built by a helper always works.

```typescript
const user = tableHelper<UserEntity>('user');
const image = tableHelper<ImageEntity>('images');
```

Join condition with the other table's column:

```typescript
query.leftJoin(ImageEntity, 'images', user.joinOn('id', `= ${image.column('userId')}`))
// LEFT JOIN "images" "images" ON "user"."id" = "images"."userId"
```

Several conditions:

```typescript
query.leftJoin(ImageEntity, 'images', [
  user.joinOn('id', `= ${image.column('userId')}`),
  image.isNotNull('url'),
].join(' AND '))
// ON "user"."id" = "images"."userId" AND "images"."url" IS NOT NULL
```

Comparing columns of two tables:

```typescript
query.andWhere(image.where('createdAt', `>= ${user.column('createdAt')}`))
// WHERE "images"."createdAt" >= "user"."createdAt"
```

With typed methods, the callback gives the left side and the helper gives the right one. No params are passed, so no placeholder is appended:

```typescript
query
  .leftJoinTyped(user => user.images, 'images')
  .andWhereTyped(user => user.id, `= ${image.column('userId')}`)
// WHERE "user"."id" = "images"."userId"
```

Subquery join: TypeORM doesn't know the `img` alias, so a helper typed by the subquery's columns does the quoting:

```typescript
const i = tableHelper<ImageEntity>('i');
const img = tableHelper<{ userId: number; imagesCount: number }>('img');

const rows = await usersRepository
  .createQueryBuilder('user')
  .leftJoin(
    qb => qb
      .from(ImageEntity, 'i')
      .select(i.column('userId'), 'userId')
      .addSelect(i.count('id'), 'imagesCount')
      .groupBy(i.column('userId')),
    'img',
    user.joinOn('id', `= ${img.column('userId')}`),
  )
  .select(user.column('id'), 'id')
  .addSelect(`COALESCE(${img.column('imagesCount')}, 0)`, 'imagesCount')
  .getRawMany();
// LEFT JOIN (SELECT "i"."userId" AS "userId", CAST(COUNT("i"."id") AS integer) AS "imagesCount"
//            FROM "images" "i" GROUP BY "i"."userId") "img"
//   ON "user"."id" = "img"."userId"
```

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
