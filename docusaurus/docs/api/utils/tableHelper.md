---
sidebar_position: 1
---

# tableHelper

## Description

`tableHelper` builds SQL fragments for an entity: column references, conditions, joins, counts, sums, aggregates and JSONB accessors. Column names are checked against the entity type, so string parts of a query get the same type safety as typed methods.

```typescript
import { tableHelper } from 'typeorm-extensions/helpers';
```

The names are the entity's property names. Given the type only (`tableHelper<Payment>('p')`), the helper writes them into the SQL as they are, so a column renamed with `@Column({ name: 'amount_cents' }) amount` comes out as `"p"."amount"`, which doesn't exist. Given the entity class (`tableHelper(Payment, 'p')`), it writes the column each property is mapped to: `tableHelper(Payment, 'p').amount` is `"p"."amount_cents"`. The class form reads the `name` of `@Column` and the other column decorators on the class and its parents, the nearest declaration winning, once per class and without a `DataSource`. Every other column keeps its property name, as under TypeORM's default naming strategy; a custom naming strategy and the columns of embedded entities are not applied.

`typeorm-extensions/helpers` has no side effects. The package root exports `tableHelper` too, but importing it installs every QueryBuilder extension.

## Signature

```typescript
tableHelper<Entity>(
  alias?: string,
  options?: { useQuotes?: boolean; driver?: DatabaseType }
): TableHelper<Entity>

tableHelper(
  entity: EntityClass<Entity>,
  alias?: string,
  options?: { useQuotes?: boolean; driver?: DatabaseType }
): TableHelper<Entity>
```

## Arguments

- entity: `EntityClass<Entity>`: The entity class, abstract ones included. The helper takes the entity type from it and writes the database names of renamed columns.
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
| `isIn(column, values, param)` | `t.isIn('id', ids, 'ids')` | `"user"."id" IN (:...ids)`, `FALSE` without ids |
| `isNotIn(column, values, param)` | `t.isNotIn('id', ids, 'ids')` | `"user"."id" NOT IN (:...ids)`, `TRUE` without ids |
| `isAny(column, values, param, arrayType?)` | `t.isAny('id', ids, 'ids', 'int[]')` | `"user"."id" = ANY(CAST(:ids AS int[]))`, `FALSE` without ids |
| `isNotAny(column, values, param, arrayType?)` | `t.isNotAny('id', ids, 'ids')` | `"user"."id" <> ALL(:ids)`, `TRUE` without ids |
| `count(column?, options?)` | `t.count('id')` | `CAST(COUNT("user"."id") AS integer)` |
| | `t.count()` | `CAST(COUNT(*) AS integer)` |
| | `t.count('email', { distinct: true })` | `CAST(COUNT(DISTINCT "user"."email") AS integer)` |
| `cast(expression, type)` | `t.cast(t.column('id'), 'text')` | `CAST("user"."id" AS text)` |
| `json(path)` | `t.json((r) => r.metadata.settings)` | `("user"."metadata" -> 'settings')` |
| `jsonText(path)` | `t.jsonText((r) => r.metadata.settings.theme)` | `("user"."metadata" -> 'settings' ->> 'theme')` |

Notes:
- Without an alias, `column()` returns just the column (`"email"`). `join()` needs an alias, the helper's or its `alias` argument; without one it throws a `TypeError`.
- `count()` casts the result to `integer`, so drivers that return counts as strings (e.g. `pg`) give a number. With `driver: 'mysql'` it casts `AS SIGNED`, since MySQL has no `AS integer`; that is a `BIGINT`, which TypeORM's MySQL driver returns as a string by default. Its options are described in [Counting](#counting).
- `column()` returns a quoted expression, so `select(t.column('id'), 'id')` keeps its position in the select list, unlike `select('user.id')`, which TypeORM moves into entity column order. See [selectTyped › Column order](../typed/selectTyped.md#column-order).
- `expression` in `where()` / `joinOn()` is inserted as is. Build the columns in it with `tableHelper` too, see [Composing helpers](#composing-helpers).

## Columns as properties

Each column is also a read-only property of the helper that gives what `column()` gives, with the same alias and options:

```typescript
const t = tableHelper<UserEntity>('user');

t.email                   // "user"."email", as t.column('email')
`${t.id} = ${image.userId}` // "user"."id" = "images"."userId"

const cte = tableHelper<Record<'utm_id' | 'total', unknown>>('cte');
cte.utm_id                // "cte"."utm_id"
```

- The members of the helper win: a column named like one of them (`alias`, `column`, `where`, `count`, `cast`, …) is reachable through `column()` only. For an entity with a `count` column, `t.count` is the method and `t.column('count')` the column.
- An unknown name doesn't compile (`t.notAColumn`). The names are the keys of the entity type, as `column()` takes them, relations included.
- Symbols and the keys that JavaScript and test tools read on any object (`then`, `toJSON`, `toString`, `valueOf`, `constructor`, `inspect`, `asymmetricMatch`, `$$typeof`, `nodeType`, and the other members of `Object.prototype`) are not columns: `await`, `JSON.stringify`, `String()`, `util.inspect` and Jest matchers treat the helper as a plain object.
- `tableHelper<Entity>()` returns a `TableHelper<Entity>`, exported for code that keeps a helper in a variable or a field.

## Value lists

```typescript
isIn(column: keyof Entity, values: readonly unknown[] | null | undefined, param: string): string
isNotIn(column: keyof Entity, values: readonly unknown[] | null | undefined, param: string): string
// PostgreSQL
isAny(column: keyof Entity, values: readonly unknown[] | null | undefined, param: string, arrayType?: string): string
isNotAny(column: keyof Entity, values: readonly unknown[] | null | undefined, param: string, arrayType?: string): string
```

The conditions of [`whereIsIn` / `whereIsNotIn`](../where/whereIsIn.md) and [`whereIsAny` / `whereIsNotAny`](../where/whereIsAny.md) as strings, for SQL those methods don't reach: a join condition, a `CASE`, a `filter` of `count`, a raw query.

- values: Read only to see whether there are any. For an empty list, `null` or `undefined` the condition is `FALSE`, `TRUE` for `isNotIn` / `isNotAny`, as the query builder methods write it: `IN ()` is a syntax error.
- param: The name the caller binds the values under, written into the SQL as `:param` (`:...param` for `isIn` / `isNotIn`). Letters, digits and `_` only. The query builder methods bind under a generated name; here the caller binds, so it names the parameter, and two conditions in one query need two names.
- arrayType?: `isAny` / `isNotAny` bind the array as one parameter, cast to this type when given (`CAST(:ids AS uuid[])`), as `whereIsAny` does. `isIn` / `isNotIn` expand it into one parameter per value, on every database.

```typescript
const image = tableHelper(ImageEntity, 'image');

userRepository
  .createQueryBuilder('user')
  .leftJoin('user.images', 'image', image.isIn('status', statuses, 'statuses'), { statuses })
  .addSelect(t.count(undefined, { filter: t.isAny('id', vipIds, 'vipIds', 'int[]') }), 'vips')
  .setParameter('vipIds', vipIds);
```

They throw a `TypeError` for a `param` that isn't a parameter name, an `arrayType` that isn't a type name, and `values` that are neither an array nor `null` / `undefined`.

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

## Sums, arrays, JSON and time zones

The other SQL functions are in [`Sql`](./sql.md), over the helper's columns: `Sql.sum`, `Sql.arrayAgg`, `Sql.jsonAgg` / `Sql.jsonbAgg`, `Sql.jsonBuildObject`, `Sql.atTimeZone`, `Sql.dateTrunc` and more. They write the function and nothing else, so an aggregate over no rows is `NULL`: wrap it in `Sql.coalesce` for a default.

```typescript
const order = tableHelper<OrderEntity>('order');
const image = tableHelper<ImageEntity>('image');

Sql.coalesce(Sql.sum(order.amountCents, { filter: order.where('status', "= 'paid'") }), 0)
// COALESCE(SUM(CASE WHEN "order"."status" = 'paid' THEN "order"."amountCents" END), 0)

Sql.coalesce(
  Sql.jsonAgg(Sql.jsonBuildObject({ imageId: image.id, src: image.url }), {
    orderBy: `${image.createdAt} DESC`,
    filter: image.isNotNull('id'),
  }),
  "CAST('[]' AS json)"
)
// the images of each group as a JSON array, [] for a group without rows

Sql.dateTrunc('day', order.paidAt, { sql: Sql.coalesce(venue.timezone, "'UTC'") })
// date_trunc('day', "order"."paidAt", COALESCE("venue"."timezone", 'UTC'))
```

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

`json` and `jsonText` read a value inside a JSON column, with the path written as a callback: `t.jsonText((r) => r.metadata.settings.theme)` is `("user"."metadata" -> 'settings' ->> 'theme')`. `json` gives the value as JSON (`->` on every key), `jsonText` as text (`->>` on the last key). They differ on a JSON `null`: `jsonText` gives SQL NULL, `json` a JSON `null` that `IS NOT NULL`. The keys are checked against the column's TypeScript type the same way as below, and any key goes below an untyped value (`unknown`, `any`, `object`, `Record<string, unknown>`). A key of digits (`r.metadata.items[0]`) is an array index, so an object key of digits can't be read this way. The result is in parentheses, so a cast or a comparison can follow it (`${t.jsonText((r) => r.paymentDetails.amount)}::int > 0`). With a `driver` it is written for that database: `JSON_EXTRACT` / `JSON_UNQUOTE` on MySQL, `->` / `->>` with a `$` path on SQLite 3.38+.

Typed where methods go into JSON columns themselves (`user => user.metadata.settings.theme`, see [Paths into JSON columns](../typed/whereTyped.md#paths-into-json-columns)), so these helpers are for the places that take an expression: select, group by, order, untyped where.

- Keys are checked against the column's TypeScript type, whether it is a type alias, an interface or a class, one key at a time to the end of the path. A union takes the keys of any of its members, so a discriminated union's variants can each be read. Dates and arrays end the path. For untyped JSON columns (`unknown`, `any`, `object`, `Record<string, unknown>`) any strings are accepted, at any depth below an `unknown` value.
- Keys are escaped as SQL string literals (`o'brien` → `'o''brien'`, and on MySQL a backslash doubled, since it is an escape there), so a key can't break out of the literal.

```typescript
type UserMetadata = {
  role: string;
  settings: { theme: string; status: string };
};

const t = tableHelper<UserEntity>('user');

t.jsonText((r) => r.metadata.role)           // ("user"."metadata" ->> 'role')
t.jsonText((r) => r.metadata.settings.theme) // ("user"."metadata" -> 'settings' ->> 'theme')
t.json((r) => r.metadata.settings)           // ("user"."metadata" -> 'settings')
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
  .andWhere(`${user.jsonText((r) => r.metadata.role)} = :role`, { role: 'admin' })
  .groupBy(user.column('id'))
  .getRawMany();
```

```typescript
// a JSON value in select and group by, which take expressions
const rows = await query
  .select(t.jsonText((r) => r.metadata.role), 'role')
  .addSelect(t.count('id'), 'users')
  .groupBy(t.jsonText((r) => r.metadata.role))
  .getRawMany();
```
