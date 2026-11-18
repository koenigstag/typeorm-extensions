---
sidebar_position: 4
---

# whereTyped

## Description
`whereTyped` is a method that applies typesafe condition to a query.

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`), together with `andWhereTyped` and `orWhereTyped`. On `UpdateQueryBuilder` / `DeleteQueryBuilder` / `SoftDeleteQueryBuilder` the column isn't prefixed with an alias (`UPDATE "users" … WHERE "firstName" = …`), since UPDATE / DELETE statements have none. Properties are mapped to their database column names, so `@Column({ name: 'first_name' }) firstName` gives `"user"."first_name"`. The same holds for `whereIsInTyped` and `whereIsAnyTyped`.

## Signature
```typescript
whereTyped(
  selection: KeyProxyCallback<Entity>,
  condition?: string | FindOperator<Value>,
  params?: unknown,
  options?: { addValue?: boolean }
): SelectQueryBuilder<Entity>

andWhereTyped(selection, condition?, params?, options?): SelectQueryBuilder<Entity>
orWhereTyped(selection, condition?, params?, options?): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects a field of entity. A callback that selects several columns (`u => [u.id, u.email]`) throws a `TypeError`: add one condition per column, or use [whereSearchTyped](./whereSearchTyped.md) to search several columns.
- condition?: string | FindOperator: Operator for the query, or a TypeORM find operator (see [Find operators](#find-operators)). A string may reference a key of `params` as a placeholder (`:key` or `(:...keys)`); then the value is not appended automatically.
- params?: unknown: Parameter for the condition. This can be an object `{ someValue: 'value' }` or the value itself `'value'`. A `Date`, a `Buffer` or a typed array is a value too: `whereTyped(u => u.createdAt, '>', since)` binds `since`. An object whose value goes after the condition holds exactly one key: with more, or none, it throws a `TypeError` (only the first value used to be bound). An object whose keys the condition names can have any number: `whereTyped(u => u.id, 'BETWEEN :from AND :to', { from, to })`.
- options?: \{ addValue?: boolean \}: Options for where logic.
- options.addValue?: boolean: The `addValue` option is controlling whether it will paste **random uniq placeholder** to condition (if true) or work as default requiring you to pass placeholder yourself (if false). Supports primitive values (placeholder `:key`), array (placeholder `(:...key)`) and a params object with one entry. Defaults to `true`, or to `false` when `condition` already references a key of `params` (e.g. `'LIKE :search'` with `{ search: '%John%' }`).

Like TypeORM's `where`, `whereTyped` replaces previously set WHERE conditions; use `andWhereTyped` / `orWhereTyped` to add to them.

## Find operators

The condition may be one of TypeORM's find operators instead of SQL, written as `find({ where })` writes it, its values bound as parameters. It takes no `params`.

```typescript
import { Any, Equal, IsNull, MoreThanOrEqual, Not } from 'typeorm';
import { EqualColumn, IsDistinctFrom, IsFalse, IsIn, IsTrue } from 'typeorm-extensions';

query
  .whereTyped((o) => o.deletedAt, IsNull())                         // "o"."deletedAt" IS NULL
  .andWhereTyped((o) => o.paidAt, Not(IsNull()))                    // NOT("o"."paidAt" IS NULL)
  .andWhereTyped((o) => o.status, Equal(OrderStatus.Successful))    // "o"."status" = :orm_param_0
  .andWhereTyped((o) => o.status, IsIn([OrderStatus.Refunded]))     // "o"."status" IN (:orm_param_1)
  .andWhereTyped((o) => o.type, Not(IsIn([OrderType.Gift])))       // NOT("o"."type" IN (:orm_param_2))
  .andWhereTyped((o) => o.createdAt, MoreThanOrEqual(since))
  .andWhereTyped((o) => o.isGift, IsTrue())                         // "o"."isGift" IS TRUE
  .andWhereTyped((o) => o.isArchived, Not(IsTrue()))                // NOT("o"."isArchived" IS TRUE): IS NOT TRUE, NULL too
  .andWhereTyped((o) => o.id, Any(orderIds))                        // "o"."id" = ANY(:orm_param_3): one array parameter
  .andWhereTyped((o) => o.note, IsDistinctFrom(note))               // "o"."note" IS DISTINCT FROM :isDistinctFrom_1
  .andWhereTyped((o) => o.userId, EqualColumn(users.id));           // "o"."userId" = "users"."id"
```

- **Checked values.** The value of `Equal`, `Not`, `MoreThan`, `MoreThanOrEqual`, `LessThan`, `LessThanOrEqual`, `Between`, `Like`, `ILike` and `Any` is checked against the column's type, without `strictParams`: `Equal('successful')` on an enum column fails type-check. TypeORM types `In()`, `IsNull()`, `Raw()` and the `Array…` operators as `FindOperator<any>`, so they fit any column: use **`IsIn([…])`**, the same operator with its values typed, and `Not(IsIn([…]))` (`IsIn(['successful'])` on an enum column fails type-check). With an explicit type argument (`whereTyped<Joins>(…)`) TypeScript can't infer the column, and nothing is checked: set the root with [`typed<Root>()`](./typedRoot.md) instead.
- **`IsTrue()` / `IsFalse()`** test a boolean column with `IS TRUE` / `IS FALSE` and fit only boolean columns. They are never NULL, so `Not(IsTrue())` is `IS NOT TRUE` and matches a NULL column too, while `Not(Equal(true))` (`NOT(col = true)`) skips it. PostgreSQL rewrites `NOT(col IS TRUE)` to `col IS NOT TRUE` and plans it the same, a partial index included; `IS TRUE` / `IS FALSE` use a btree index on the column like `= true` / `= false`. PostgreSQL, SQLite 3.23+ and MySQL.
- **`Any([…])`**, TypeORM's, binds the list as one array parameter, `= ANY(:param)`, where `IsIn` binds a parameter per value: for long lists, past the database's limit of bound parameters. Its values are checked like `IsIn`'s; an empty list matches no row. PostgreSQL.
- **`IsDistinctFrom(value)`** is `IS DISTINCT FROM`: unlike `Not(Equal(…))`, it matches a NULL column too, and `IsDistinctFrom(null)` matches the rows that aren't NULL. `Not(IsDistinctFrom(value))` is an `=` that matches NULL to NULL. The value may be `null` for any column. PostgreSQL and SQLite 3.39+; on MySQL / MariaDB use [`whereIsDistinctFrom`](../where/whereIsDistinctFrom.md), which writes `<=>`.
- **`EqualColumn(sql)`** compares the column with another column or an SQL expression, written as is; `Not(EqualColumn(…))` negates it.
- An empty `IsIn([])` / `In([])` matches no row (`0=1`), as in `find()`; an empty `Not(IsIn([]))` matches every row. Like SQL `NOT IN`, `Not(IsIn(…))` never matches a row whose column is NULL.

## Paths into JSON columns

A callback may go into a JSON column (`json`, `jsonb` or `simple-json`): the keys after the column become a JSON path.

```typescript
// "exec"."details" ->> 'outcome' = 'executed'
query.andWhereTyped(exec => exec.details.outcome, `= 'executed'`)

// CAST("exec"."details" -> 'meta' ->> 'endTs' AS numeric) >= :param
query.andWhereTyped(exec => exec.details.meta.endTs, '>=', { endTime: endDate.getTime() })
```

- **Depth.** Two levels (`column.key`, or `alias.column` on a joined entity) work with any JSON column. To go deeper, mark the property with `Json<T>`; without it TypeScript can't tell a JSON object from a relation, and relations stop at `alias.column`:

  ```typescript
  import { Json } from 'typeorm-extensions';

  @Column({ type: 'jsonb' })
  details: Json<ExecutionDetails>; // values stay assignable both ways
  ```

  Arrays inside the JSON are values: `e => e.details.tags` compares the whole array.
- **Types of values.** `->>` gives text on PostgreSQL, and text compares `'9' >= '10'` as true. So the path is cast to the type of the value it is compared with: a number to `numeric`, a boolean to `boolean`, a `Date` to `timestamptz`. A string, or a condition without a value (`= 'executed'`), stays text. On SQLite `->>` gives SQL values and nothing is cast.
- **Numeric text in an ordering comparison.** With `<`, `>`, `<=` or `>=` (also `'>= :min'` with a params object), a string that is a number (`'10'`, as a query string gives it) is bound as that number, so it compares like `10` on both databases. Other operators keep a string as text: `= '01234'` stays a match on that text.
- **Indexes.** An expression index is used only for the same expression: `((details ->> 'outcome'))`, or `((details -> 'meta' ->> 'endTs')::numeric)` for the cast one. For equality on a hot path, `whereJsonContainsTyped` (`@>`, a GIN index) is the better fit.
- **Where it works.** In `whereTyped` and the other typed where methods (`whereIsInTyped`, `whereIsAnyTyped`, `whereIsDistinctFromTyped`, …); `whereJsonContainsTyped` / `whereJsonHasKeyTyped` use `->`, the JSON value. Select, order, distinct and group by take columns only and throw a `TypeError` for a JSON path. PostgreSQL (a `simple-json` column is read as `jsonb` there) and SQLite 3.38+; other databases throw a `TypeError`.

## Checking parameters: `strictParams`

By default `params` is `unknown`. Augment `TypeormExtensionsConfig` once in your project to check it against the type of the column the callback selects:

```typescript
declare module 'typeorm-extensions' {
  interface TypeormExtensionsConfig {
    strictParams: true;
  }
}
```

The expected value depends on the operator (matched case-insensitively):

| Operator | `params` |
| --- | --- |
| `=`, `<>`, `!=`, `<`, `<=`, `>`, `>=` | the column's value, required, never `null` / `undefined` (`= NULL` matches no row) |
| `IS DISTINCT FROM`, `IS NOT DISTINCT FROM` | the column's value or `null` |
| `IS`, `IS NOT` | `null` |
| `IN`, `NOT IN` | an array of the column's values |
| `LIKE`, `ILIKE`, `NOT LIKE`, `NOT ILIKE` | a string |
| `IS NULL`, `IS NOT NULL`, `IS [NOT] TRUE`, `IS [NOT] FALSE`, `IS [NOT] UNKNOWN` | none |
| anything else (`'BETWEEN :from AND :to'`, `'= true'`) | not checked |

A date column takes a `Date` or a string. The value may be passed as is or in a `{ name: value }` params object, except a plain object (a JSON column): at runtime a plain object always is a params object, so it has to be wrapped.

```typescript
query.whereTyped(e => e.price, '>=', { minPrice: 10 });     // ok
query.whereTyped(e => e.price, '>=', '10');                 // error: string for a number column
query.whereTyped(e => e.cityId, '=', { cityId: undefined }); // error: = NULL matches no row
query.whereTyped(e => e.id, 'IN', 'a');                     // error: IN takes an array
query.whereTyped(e => e.settings, '=', { settings: value }); // ok; the bare `value` doesn't compile
```

Calls with an explicit type argument (`whereTyped<Joins>(…)`) stay unchecked: TypeScript can't infer the column type when one type argument is given. Set the root with [`typed<Joins>()`](./typedRoot.md) instead, and the calls are checked.

## Usage

```typescript
// same as `query.where('user.name LIKE :name', { name: '%John%' })`
query
  .whereTyped(
    user => user.name,
    'LIKE',
    '%John%',
  )
```

```typescript
// same as `query.andWhere('user.name LIKE :name', { name: '%Doe%' })`
query
  .andWhereTyped(
    user => user.name,
    'LIKE',
    { name: '%Doe%' },
  )
```

```typescript
// same as `query.orWhere('user.name LIKE :search', { search: '%John Doe%' })`
// `:search` is a key of params, so no extra placeholder is appended
query
  .orWhereTyped(
    user => user.name,
    'LIKE :search',
    { search: '%John Doe%' },
  )
```

```typescript
// arrays get a `(:...key)` placeholder
// same as `query.where('user.id IN (:...ids)', { ids: [1, 2, 3] })`
query.whereTyped(user => user.id, 'IN', [1, 2, 3])
```

```typescript
// columns of joined relations, including array relations (`images: ImageEntity[]`)
// same as `query.andWhere('images.url IS NOT NULL')`
query
  .leftJoinTyped(user => user.images, 'images')
  .andWhereTyped(user => user.images.url, 'IS NOT NULL')
```

```typescript
// a key of a JSON column, see "Paths into JSON columns" above
// same as `query.where("user.metadata ->> 'role' = :role", { role: 'admin' })`
query.whereTyped(user => user.metadata.role, '=', 'admin')
```
