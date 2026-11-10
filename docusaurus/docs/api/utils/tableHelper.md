---
sidebar_position: 1
---

# tableHelper

## Description

`tableHelper` builds SQL fragments for an entity: column references, conditions, joins, counts, sums, aggregates and JSONB accessors. Column names are checked against the entity type, so string parts of a query get the same type safety as typed methods.

```typescript
import { tableHelper } from 'typeorm-extensions/helpers';
```

`typeorm-extensions/helpers` has no side effects. The package root exports `tableHelper` too, but importing it installs every QueryBuilder extension.

## Signature

```typescript
tableHelper<Entity>(
  alias?: string,
  options?: { useQuotes?: boolean; driver?: DatabaseType }
)
```

## Arguments

- alias?: string: Alias of the table in the query, e.g. `'user'` for `createQueryBuilder('user')`.
- options.useQuotes?: boolean: Quote identifiers (`"user"."email"`). Default `true`; with `false` they are left as is (`user.email`).
- options.driver?: DatabaseType: The database the SQL is for. MySQL and MariaDB quote identifiers with backticks (`` `user`.`email` ``); without it they get double quotes. Pass `dataSource.options.type`.

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
| `sum(column, options?)` | `image.sum('size')` | `COALESCE(SUM("images"."size"), 0)` |
| `arrayAgg(column, options?)` | `image.arrayAgg('id')` | `COALESCE(array_agg("images"."id"), '{}')` |
| `cast(expression, type)` | `t.cast(t.column('id'), 'text')` | `CAST("user"."id" AS text)` |
| `jsonColumn(column, operator, ...keys)` | `t.jsonColumn('metadata', '->>', 'role')` | `"user"."metadata" ->> 'role'` |
| `jsonPath(column, operator, ...keys)` | `t.jsonPath('metadata', '->>', 'role')` | `->> 'role'` |
| `jsonBuildObject(columns, options?)` | `image.jsonBuildObject(['id', 'url'])` | `json_build_object('id', "images"."id", 'url', "images"."url")` |
| `jsonAgg(expression, options?)` | `image.jsonAgg(image.column('url'))` | `COALESCE(json_agg("images"."url"), CAST('[]' AS json))` |

Notes:
- Without an alias, `column()` returns just the column (`"email"`). `join()` needs an alias, the helper's or its `alias` argument; without one it throws a `TypeError`.
- `count()` casts the result to `integer`, so drivers that return counts as strings (e.g. `pg`) give a number. With `driver: 'mysql'` it casts `AS SIGNED`, since MySQL has no `AS integer`; that is a `BIGINT`, which TypeORM's MySQL driver returns as a string by default. Its options are described in [Counting](#counting).
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

## Sums

```typescript
sum(column: NumberColumn<Entity>, options?: { filter?: string; syntax?: 'case' | 'filter' }): string
```

`COALESCE(SUM(column), 0)`: 0, not `NULL`, for a group without rows or a `LEFT JOIN` without a match. Only a column whose property is a `number` or a `bigint` compiles: `t.sum('email')` is a type error. `filter` and `syntax` work as for `count`.

```typescript
const order = tableHelper<OrderEntity>('order');

order.sum('amountCents', { filter: order.where('status', "= 'paid'") })
// COALESCE(SUM(CASE WHEN "order"."status" = 'paid' THEN "order"."amountCents" END), 0)
```

The result isn't cast: a sum outgrows `integer` sooner than a count. PostgreSQL sums integers into a `bigint` and MySQL into a `DECIMAL`, which the drivers return as strings; convert them, or select into a [`@CalculatedColumn`](../columns/calculatedColumn.md) of type `number`.

## Arrays (PostgreSQL)

```typescript
arrayAgg(column: Column<Entity>, options?: { distinct?: boolean; orderBy?: Column | [Column, 'ASC' | 'DESC']; filter?: string }): string
```

The PostgreSQL array of a column over the rows of a group, `{}` for a group without rows:

```typescript
image.arrayAgg('id', { orderBy: ['id', 'DESC'], filter: image.isNotNull('id') })
// COALESCE(array_agg("images"."id" ORDER BY "images"."id" DESC) FILTER (WHERE "images"."id" IS NOT NULL), '{}')
```

- **`filter`**: after a `LEFT JOIN` without a match, the array is `{NULL}` without it; filter on a non-null column of the joined table.
- **`distinct`**: each value once. PostgreSQL then orders only by the aggregated column, so another `orderBy` throws a `TypeError`.
- The driver returns a JavaScript array. MySQL and SQLite have no arrays: with their `driver` it throws a `TypeError`, use [`jsonAgg`](#json-objects-and-arrays) there.

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

## JSON objects and arrays

`jsonBuildObject` builds a JSON object from columns, `jsonAgg` aggregates an expression over the rows of a group into a JSON array. Together they return a row with its related rows nested, in one query:

```typescript
const image = tableHelper<ImageEntity>('image', { driver: 'postgres' });

const users = await userRepository
  .createQueryBuilder('user')
  .select('user.id', 'id')
  .addSelect(
    image.jsonAgg(image.jsonBuildObject({ imageId: 'id', src: 'url' }), {
      orderBy: ['createdAt', 'DESC'],
      filter: image.isNotNull('id'),
    }),
    'images'
  )
  .leftJoin('user.images', 'image')
  .groupBy('user.id')
  .getRawMany();

// [{ id: 1, images: [{ imageId: 2, src: '…' }, { imageId: 1, src: '…' }] }, { id: 3, images: [] }]
```

```sql
COALESCE(
  json_agg(json_build_object('imageId', "image"."id", 'src', "image"."url") ORDER BY "image"."createdAt" DESC)
    FILTER (WHERE "image"."id" IS NOT NULL),
  CAST('[]' AS json)
)
```

- **Columns are checked against the entity type**: the columns of `jsonBuildObject`, as a list (keys are the column names) or as a `{ key: column }` map, and the column of `orderBy`. Keys are escaped as SQL string literals.
- **`[]` for a group without rows**: `jsonAgg` wraps the aggregate in `COALESCE(…, [])`, since an aggregate over no rows is `NULL`.
- **`filter`** aggregates only the matching rows. After a LEFT JOIN without a match the row has `NULL` columns, which would otherwise come out as `[{"imageId": null, "src": null}]`: filter on a non-null column of the joined table, `image.isNotNull('id')`.
- **`orderBy`** orders the array by a column of the helper's table: `'createdAt'` or `['createdAt', 'DESC']`.
- **`jsonb: true`** uses `jsonb_build_object` / `jsonb_agg` (PostgreSQL).

The functions follow the helper's `driver` option:

| Database | Object | Array | Notes |
|---|---|---|---|
| PostgreSQL, CockroachDB (default) | `json_build_object` / `jsonb_build_object` | `json_agg` / `jsonb_agg` | parsed by the driver |
| MySQL / MariaDB | `JSON_OBJECT` | `JSON_ARRAYAGG` | no `orderBy`, `filter` or `jsonb`: they throw a `TypeError` |
| SQLite | `json_object` | `json_group_array` | returned as text: `JSON.parse` it; `orderBy` needs SQLite 3.44+ |

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
