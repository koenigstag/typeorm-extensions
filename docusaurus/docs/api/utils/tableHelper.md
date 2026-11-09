---
sidebar_position: 1
---

# tableHelper

## Description

`tableHelper` builds SQL fragments for an entity: column references, conditions, joins, counts and JSONB accessors. Column names are checked against the entity type, so string parts of a query get the same type safety as typed methods.

```typescript
import { tableHelper } from 'typeorm-extensions/helpers';
```

`typeorm-extensions/helpers` has no side effects. The package root exports `tableHelper` too, but importing it installs every QueryBuilder extension.

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
| `join(relation, alias?)` | `t.join('images')` | `user.images` |
| `joinOn(column, expression)` | `t.joinOn('id', '= ' + image.column('userId'))` | `"user"."id" = "images"."userId"` |
| `isNull(column)` | `t.isNull('deletedAt')` | `"user"."deletedAt" IS NULL` |
| `isNotNull(column)` | `t.isNotNull('email')` | `"user"."email" IS NOT NULL` |
| `count(column?, options?)` | `t.count('id')` | `CAST(COUNT("user"."id") AS integer)` |
| | `t.count()` | `CAST(COUNT(*) AS integer)` |
| | `t.count('email', { distinct: true })` | `CAST(COUNT(DISTINCT "user"."email") AS integer)` |
| `cast(expression, type)` | `t.cast(t.column('id'), 'text')` | `CAST("user"."id" AS text)` |
| `jsonColumn(column, operator, ...keys)` | `t.jsonColumn('metadata', '->>', 'role')` | `"user"."metadata" ->> 'role'` |
| `jsonPath(column, operator, ...keys)` | `t.jsonPath('metadata', '->>', 'role')` | `->> 'role'` |

Notes:
- Without an alias, `column()` returns just the column (`"email"`). `join()` needs an alias, the helper's or its `alias` argument; without one it throws a `TypeError`.
- `count()` casts the result to `integer`, so drivers that return counts as strings (e.g. `pg`) give a number. Its options are described in [Counting](#counting).
- `column()` returns a quoted expression, so `select(t.column('id'), 'id')` keeps its position in the select list, unlike `select('user.id')`, which TypeORM moves into entity column order. See [selectTyped › Column order](../typed/selectTyped.md#column-order).
- `expression` in `where()` / `joinOn()` is inserted as is. Build the columns in it with `tableHelper` too, see [Composing helpers](#composing-helpers).

## Counting

```typescript
count(
  column?: keyof Entity,
  options?: { distinct?: boolean; filter?: string; syntax?: 'case' | 'filter' }
): string
```

- column?: Column to count: rows where it is not `NULL`. Without a column it is `COUNT(*)`, every row of the result.
- options.distinct?: boolean: `COUNT(DISTINCT column)`, the number of different values. Needs a column.
- options.filter?: string: Count only the rows that match this condition. It is inserted as is: build it with `tableHelper` (`t.isNull('deletedAt')`, `t.where('status', "= 'active'")`).
- options.syntax?: `'case' | 'filter'`: How `filter` is written:
  - `'case'` (default): `COUNT(CASE WHEN filter THEN column END)`. Works in every database.
  - `'filter'`: `COUNT(column) FILTER (WHERE filter)`. PostgreSQL and SQLite 3.30+ only. On PostgreSQL it is a few percent faster.

```typescript
t.count(undefined, { filter: t.isNull('deletedAt') })
// CAST(COUNT(CASE WHEN "user"."deletedAt" IS NULL THEN 1 END) AS integer)

t.count(undefined, { filter: t.isNull('deletedAt'), syntax: 'filter' })
// CAST(COUNT(*) FILTER (WHERE "user"."deletedAt" IS NULL) AS integer)

t.count('email', { distinct: true, filter: t.isNull('deletedAt') })
// CAST(COUNT(DISTINCT CASE WHEN "user"."deletedAt" IS NULL THEN "user"."email" END) AS integer)
```

Several counts in one query:

```typescript
const t = tableHelper<UserEntity>('user');

const stats = await userRepository
  .createQueryBuilder('user')
  .select(t.count(), 'total')
  .addSelect(t.count(undefined, { filter: t.isNull('deletedAt') }), 'active')
  .addSelect(t.count('email', { distinct: true }), 'emails')
  .getRawOne();
// { total: 120, active: 97, emails: 118 }
```

With a `LEFT JOIN`, `COUNT(*)` also counts the row of a user without images. To count the joined rows, count a non-null column of the joined table: `image.count('id')`.

`count()` throws a `TypeError` for `distinct` without a column, for an unknown `syntax`, and for a second argument that is not an options object.

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

Typed where methods go into JSON columns themselves (`user => user.metadata.settings.theme`, see [Paths into JSON columns](../typed/whereTyped.md#paths-into-json-columns)), so these helpers are for the places that take an expression: select, group by, order, untyped where.

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
// a JSON value in select and group by, which take expressions
const rows = await query
  .select(t.jsonColumn('metadata', '->>', 'role'), 'role')
  .addSelect(t.count('id'), 'users')
  .groupBy(t.jsonColumn('metadata', '->>', 'role'))
  .getRawMany();
```
