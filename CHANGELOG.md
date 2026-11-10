# Changelog

## [Unreleased]

### New Features

- **`@CalculatedColumn` and `addSelectCalculated`**: an entity property that a query fills with an SQL expression of its own. The decorator declares no column of the table (schema sync leaves it out, it is never inserted or updated, and TypeORM never selects it by itself); `addSelectCalculated(expression or subquery, property, alias?)` selects into it under the key TypeORM hydrates from, with the property checked against the entity type. The value is converted by the property's type, so a `number` turns a PostgreSQL `COUNT` or an `AVG` into a number with its decimals, and a `boolean` reads `0` / `'0'` as false on every database. Unlike TypeORM's `@VirtualColumn`, it costs nothing until a query asks for it.

## [2.2.0] - 2026-11-10

A minor version, which also carries the MIT license prepared for 2.1.1: 2.1.1 was never published. Code that reads the results needs no change. Code that builds a `ListWithTotals` or a `ListWithCursor` itself (a mock, a wrapper) has to add `hasMore`, and `orderBy` for `ListWithTotals`. Without a query runner of its own, `getManyWithTotals` now holds two pool connections for the length of the call instead of one.

### New Features

- **`hasMore` on both paginated results**: `getManyWithTotals` returns `offset + list.length < total`, and with `disableTotalsCalculation` reads the page one row longer instead of counting — the extra row is dropped from `list` and only answers `hasMore`, so no `COUNT` query runs and the flag is still known. `null` only with `loadAll`, where the page is every row. `getManyWithCursor` returns a boolean the same way, from the `pageSize + 1` rows its keyset query already loads.

- **`orderBy` on `ListWithTotals`**: the ORDER BY the page was read in, as `OrderType[]`, for logs and debugging. These are SQL selectors (`"user"."created_at"`, a generated `array_position_…` alias, a raw expression), not properties of the entity. Without an explicit order it is the `orderBy` of `@Entity`, like the SQL; empty with the `disable-global-order` option.

### Improvements

- **Licensed under MIT, and the package ships the license text**: `package.json` said ISC, but there was no `LICENSE` file in the repository or the npm package. From 2.2.0 on the license is MIT, with the text in `LICENSE`; versions up to 2.1.0 stay ISC.
- **`getManyWithTotals` runs its count and its page query at the same time**, so the call takes as long as the slower one instead of their sum. The count goes on a clone of the builder, taken before the page query applies its limit. On a builder bound to a query runner — from a transactional manager, or inside `dataSource.transaction` — the two still run one after another: there is a single connection, on which the driver would serialise them anyway.
- **`tableHelper` takes a `driver` option**: `tableHelper('user', { driver: 'mysql' })` quotes with backticks.

### Bug Fixes

- **Identifiers quoted for MySQL / MariaDB**: `applyOrder` / `applyOrderFilter`, and `orderByTyped` / `addOrderByTyped` / `selectTyped` with `useQuotes`, put double quotes around column names on every database. On MySQL a double-quoted name is a string, so ordering by `"ticket_status"` ordered by a constant and returned the rows in no particular order without an error, and `"t"."ticket_id"` was a syntax error. They now quote with backticks there. The test suite runs on MySQL 8.4 in CI.

## [2.1.0] - 2026-11-09

A minor version: nothing needs changing when upgrading from 2.0.0. `strictParams` is opt-in, and a typed key
into a JSON column used to build SQL that failed, so no working query changes.

### New Features

- **`strictParams`: typed where parameters checked against the column type**, opt-in through module augmentation:
  ```ts
  declare module 'typeorm-extensions' {
    interface TypeormExtensionsConfig {
      strictParams: true;
    }
  }
  ```
  The type of the column comes from the callback, the expected value from the operator of `whereTyped` / `andWhereTyped` / `orWhereTyped`:
  - `=`, `<>`, `!=`, `<`, `<=`, `>`, `>=` take the column's value, never `null` / `undefined` (`= NULL` matches no row); `IS [NOT] DISTINCT FROM` takes `null` too, `IS` / `IS NOT` only `null`;
  - `IN` / `NOT IN` take an array of values, `LIKE` / `ILIKE` (and `NOT`) a string, `IS NULL`, `IS TRUE` and the like nothing;
  - a date column takes a `Date` or a string; the value may be passed as is or in a `{ name: value }` params object, except a plain object (a JSON column), which only fits in a params object: at runtime a plain object always is one.

  `whereIsInTyped` / `whereIsAnyTyped` and their `Not`, `and` / `or` variants take an array of the column's values. Conditions written as SQL (`'BETWEEN :from AND :to'`, `'= true'`) and calls with an explicit type argument (`whereTyped<Joins>(…)`) stay unchecked. Without the option nothing changes.

- **Typed keys into JSON columns**: in typed where methods a callback may go into a `json` / `jsonb` / `simple-json` column, `exec => exec.details.meta.endTs` → `"exec"."details" -> 'meta' ->> 'endTs'`, on the main entity or a joined alias. On PostgreSQL the path is cast to the type of the compared value (`numeric`, `boolean`, `timestamptz`), since `->>` gives text and text compares `'9' >= '10'` as true; `whereJsonContainsTyped` / `whereJsonHasKeyTyped` take the JSON value (`->`). PostgreSQL and SQLite 3.38+, other databases throw a `TypeError`.
  - Two levels work with any JSON column. For deeper paths mark the property with the new `Json<T>` type (`details: Json<ExecutionDetails>`): TypeScript can't tell a JSON object from a relation, and relations still stop at `alias.column`.
  - Select, order and distinct take columns only: a JSON path there throws a `TypeError`.
  - `applyPeriodFilterTyped` compares a JSON path as a timestamp: `CAST(… AS timestamptz)` on PostgreSQL, `strftime` on SQLite. As text, a date stored as `'…T12:00:00.000Z'` didn't match a `Date` bound on its own day.

### Bug Fixes

- **A typed key into a JSON column built a wrong column**: `u => u.metadata.role` gave `"metadata"."role"`, as if `metadata` were an alias, which failed in the database. Where methods now build the JSON path, select / order / distinct throw a `TypeError`.
- **Typed callbacks give a `Date` (or `Buffer`) column its own type**: the proxy used to treat it as an object to go into, so `u => u.createdAt` was typed as a mapped `Date`, and a date column of a relation (`u => u.images.createdAt`) as the end of the key path.

## [2.0.0] - 2026-11-05

A major version: the changes under **Breaking Changes** need code changes when upgrading from 1.x
(`^1.3.5` ranges don't pick 2.0.0 up). Most of the **Bug Fixes** make SQL correct that used to fail,
e.g. typed keys and `applyOrder` now use database column names (`@Column({ name })`).

### Breaking Changes

- **Renamed `useDoubleQuotes` to `useQuotes`** in `ApplyOrderOptions`. The positional `useDoubleQuotes` parameter of `selectTyped` / `addSelectTyped` is renamed to `useQuotes` as well (positional calls keep working).
- **Removed `useDoubleQuotes` from the typed where options** (#29):
  - `TypedWhereOptions` (`whereTyped` and its `and` / `or` variants) keeps only `addValue`;
  - `whereIsInTyped` / `whereIsNotInTyped` and their `and` / `or` variants no longer take an options argument, and the exported `TypedWhereIsInOptions` type is removed.

  The option never had an effect, in 1.3.5 either: the key was quoted with or without it, and typed keys are now always the quoted database column. Migrate by deleting `useDoubleQuotes` from `whereTyped` options and dropping the last argument of `whereIsInTyped` calls.
- **`whereTyped` / `whereIsInTyped` / `whereIsNotInTyped` (and their `and` / `or` variants) throw a `TypeError` for a callback that selects several columns,** like `whereIsAnyTyped` (#29).
  - Previously they added one condition per column: `where…` kept only the last one, while `and…` / `or…` silently joined them with AND / OR.
  - Migrate to one call per column. For an OR search over several columns, use `whereSearchTyped`.
- **`addOrderByTyped` takes an options object as its 4th argument**: `useDoubleQuotes?: boolean` became `options?: TypedOrderByOptions`. Migrate `addOrderByTyped(cb, 'ASC', undefined, true)` to `addOrderByTyped(cb, 'ASC', undefined, { useQuotes: true })`. In plain JS a boolean passed there is now ignored, so `true` silently stops quoting the key (`user.name` instead of `"user"."name"`).
- **Typed key paths are limited to `column` / `alias.column`** (#16). A callback reaching a third level (`u => u.images.user.email`, `u => u.metadata.settings.theme`) is a compile error and throws a `TypeError` at runtime. Previously the path was cut to its first two keys without notice: typed where failed in the database, while select / orderBy / distinctOn used the relation's join column, so `x => x.images.user.id` happened to return the foreign key and any other field returned it too. Migrate `x.rel.rel2.id` to the foreign key property (`x => x.images.userId`); for other columns of nested relations, join them and address the join alias with an alias-keyed type (`(j: { imageUser: UserEntity }) => j.imageUser.email`).
- **String fields that the query can't resolve are quoted only when they are paths of identifiers** (#14, #28): the untyped methods (`whereIsIn`, `whereIsAny`, …) quote a column of a query alias whatever its name (`'user.first-name'` → `"user"."first-name"`), and leave an expression such as `LOWER(u.email)` as it is. A field the query doesn't know (an alias of a subquery or of a table given by name) is quoted only when it is a path of plain identifiers: a name like `sub.first-name` there used to be quoted piece by piece and is now passed as is. Quote such a name yourself: `'sub."first-name"'`.
- **`ArgsType` is `readonly unknown[]`** (#11), so the IN / ANY methods accept readonly arrays. Code that used the exported `ArgsType` for its own arrays and changes them (`push`, assignment by index) needs `unknown[]` instead.

### New Features

- **TypeORM 1.x support**: the peer dependency is `"typeorm": "^0.3.12 || ^1.0.0"`, so the package installs next to TypeORM 1.x without `--legacy-peer-deps`. CI tests TypeORM 0.3.12, the latest 0.3.x and the latest 1.x; every release from 0.3.24 to 1.1.2 was tested on SQLite and PostgreSQL. (#30, #31)
- **`tableHelper` utility**, exported from the package root (`import { tableHelper } from 'typeorm-extensions'`) — type-safe SQL helper for building column references, WHERE expressions, JOIN clauses, and JSONB accessors. (#5)
  - `column()` — quoted SQL column identifier
  - `where()` — column with expression
  - `join()` / `joinOn()` — join path helpers (`join(relation, alias?)` throws when there is no alias; #29)
  - `isNull()` / `isNotNull()` — null check expressions
  - `count()` / `cast()` — aggregate and cast helpers (#7, #29). `count(column?, { distinct, filter, syntax })`:
    - `COUNT(*)` without a column;
    - `COUNT(DISTINCT col)` with `distinct`;
    - conditional counts with `filter`, as `COUNT(CASE WHEN … THEN … END)` by default (any database) or, with `syntax: 'filter'`, `COUNT(…) FILTER (WHERE …)` (PostgreSQL, SQLite 3.30+).
  - `jsonColumn()` — full JSONB column access expression with typed field names
  - `jsonPath()` — JSONB operator fragment for use in `whereTyped` conditions strings
- **JSONB access via `tableHelper`** with nested paths as rest params. Field names are inferred from the column's TypeScript type (autocomplete up to 4 levels deep) and escaped as SQL string literals (#8):
  ```ts
  const t = tableHelper<User>('user');
  t.jsonColumn('metadata', '->>', 'role')               // "user"."metadata" ->> 'role'
  t.jsonColumn('metadata', '->>', 'settings', 'theme')   // "user"."metadata" -> 'settings' ->> 'theme'
  t.jsonPath('metadata', '->>', 'role')                  // ->> 'role'
  ```
- **`TypedOrderByOptions`** — options for `orderByTyped` and `addOrderByTyped` with `useQuotes` support (`orderByTyped` had no quoting option before).
- **`whereIsAny` / `andWhereIsAny` / `orWhereIsAny`** and typed `whereIsAnyTyped` / `andWhereIsAnyTyped` / `orWhereIsAnyTyped` (PostgreSQL): `column = ANY(:array)` with the whole array bound as one parameter, so the number of values isn't limited by the 65535 bind parameters that `IN` runs into. An empty array becomes `FALSE`. (#12)
- **`typeorm-extensions/helpers`**: a side-effect-free entry point that exports `tableHelper` (and its types) without installing any QueryBuilder extension, unlike the package root. (#18)
- **`whereIsAny` `arrayType`** (+ typed): an optional third argument casts the array parameter, `= ANY(CAST(:param AS uuid[]))`; the type name is validated. **`whereIsNotAny`** / `andWhereIsNotAny` / `orWhereIsNotAny` (+ typed) build `<> ALL(:param)`: the column differs from every value; an empty array becomes `TRUE`, like `NOT IN`. (#19)
- **PostgreSQL array and JSON where methods** (+ `and` / `or` and typed variants, on Select, Update and Delete builders) (#21):
  - `whereArrayContains` / `whereArrayContainedBy` / `whereArrayOverlaps`: `@>`, `<@`, `&&` on array columns, the values bound as one array parameter, with an optional `arrayType` cast.
  - `whereJsonContains` / `whereJsonHasKey`: `@>` and `?` on the column cast to `jsonb`, so `json` and `simple-json` columns work too; on `jsonb` columns the cast is dropped and a GIN index is still used.
- **`whereIsDistinctFrom` / `whereIsNotDistinctFrom`** (+ `and` / `or` and typed variants): null-safe comparisons, where `NULL` equals `NULL`. `IS [NOT] DISTINCT FROM` on PostgreSQL and most databases, `<=>` on MySQL / MariaDB, `IS [NOT]` on SQLite. (#21)
- **String search methods** (typed, with `and` / `or` variants, on Select, Update and Delete builders) (#27):
  - `whereILikeTyped(sel, value, { match, escape, unaccent })`: `ILIKE` with `%` / `_` / `\` escaped and `contains` / `prefix` / `suffix` / `exact` matching (`LIKE` on MySQL / MariaDB, `LIKE … ESCAPE` on SQLite); a blank value adds nothing.
  - `whereSearchTyped([...selectors], value, options)`: one parenthesized `OR` group of `ILIKE`s over several columns or SQL expressions, with a single parameter.
  - `whereLowerEqualsTyped` / `whereIsInLowerTyped`: `LOWER(col) = LOWER(:p)` / `LOWER(col) IN (…)`, with a `normalize` wrapper to match an expression index.
  - `whereSimilarTyped` / `addSimilarityScoreTyped` (PostgreSQL + `pg_trgm`): `%`, `%>`, `<%` and `similarity()` scores.
  - `escapeLikePattern`, exported from the root and from `typeorm-extensions/helpers`.
- **`PeriodFilter` + `applyPeriodFilter` / `applyPeriodFilterTyped`** (Select, Update, Delete; any database): `{ periodFrom?, periodTo? }` of `Date | string` adds `column >= periodFrom` / `column <= periodTo` with AND around the existing conditions. Missing or empty ends are skipped; `includeFrom` / `includeTo: false` exclude an end; a date-only string is a whole day (`periodTo: '2024-01-31'` → `< '2024-02-01'`). (#23)
- **`getManyWithCursor(cursorFilter, { orderBy })`**: keyset (cursor) pagination returning `{ list, nextCursor }`. The primary key is appended to the order, date / time keys keep the database's precision (PostgreSQL microseconds), and an invalid cursor throws the exported `InvalidCursorError`. (#23)
- **`orderByArrayPosition` / `addOrderByArrayPosition`** (+ typed, PostgreSQL): order by the position of the column's value in an array, also with `take` and joins. (#23)
- **`returningTyped(x => [x.id, x.status])`** on Insert, Update, Delete and SoftDelete builders: RETURNING columns from entity properties, throwing for properties that aren't columns. (#23)

### Bug Fixes

- Typed proxy callbacks no longer fail with type errors on array relations (e.g. `user => user.images.url` where `images` is `ImageEntity[]`): arrays are unwrapped in the proxy type of all typed methods.
- `whereIsNotInTyped` / `andWhereIsNotInTyped` / `orWhereIsNotInTyped` on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder` now default `Type` to the builder's entity, like the `IsIn` variants. Previously the callback accepted any property. (#4)
- `whereTyped` / `andWhereTyped` / `orWhereTyped`: when `options.addValue` is not set, it now defaults to `false` if `condition` already references a key of `params` (`'= :id'` with `{ id }`, `'IN (:...ids)'` with `{ ids }`). Previously a second placeholder was appended and the SQL was invalid. `::type` casts and colons inside literals are not treated as placeholders. (#6)
- `whereIsIn` / `whereIsNotIn` and their `and` / `or` and typed variants accept readonly arrays and `as const` constants: the values argument (`ArgsType`) is now `readonly unknown[]`. Previously they failed to type-check with TS2345. (#11)
- Fields of `whereIsIn` / `whereIsNotIn` / `whereIsAny` and of the typed where methods: only a path of identifiers is quoted (`user.id` → `"user"."id"`, `user.*` → `"user".*`); an expression such as `COALESCE(ts."instructorId", e."instructorId")`, `LOWER(u.email)` or `u.id::text` is used as is. Previously it was split on dots and quoted piece by piece into invalid SQL. See also Breaking Changes. (#14)
- Typed where methods on `UpdateQueryBuilder` / `DeleteQueryBuilder` no longer qualify the column with the alias: `WHERE "firstName" = …` instead of `WHERE "UserEntity"."firstName" = …`, which PostgreSQL accepted only when the alias equaled the table name and SQLite rejected. (#15)
- Typed where methods (`whereTyped`, `whereIsInTyped` / `whereIsNotInTyped`, `whereIsAnyTyped`) map properties to their database column names (`@Column({ name })`) through the alias metadata. Previously they emitted the property name, so a condition on a renamed column hit a nonexistent (or wrong) column. (#17)
- Typed keys on embedded columns (`p => p.address.city`) resolve to the main alias column (`"p"."addressCity"`) in where, select, orderBy and distinctOn, instead of being read as alias `address`. With `useQuotes`, `selectTyped` / `orderByTyped` emit database column names, and an array of callbacks in `selectTyped` honors `useQuotes`. (#20)
- `whereTyped` / `andWhereTyped` / `orWhereTyped` bind a `Date` (or a `Buffer` / typed array) as the value. Previously it was read as a params object: a `Date` has no own keys, so `whereTyped(u => u.createdAt, '>', date)` compared with `NULL` and returned nothing, and a `Buffer` was bound as its first byte. An invalid `Date` compares with `NULL`, like `NaN`. Class instances with named placeholders still work as params objects. (#22)
- `stringToSQLIdentifier` quotes with backticks for MariaDB too, not only `mysql` / `aurora-mysql`. (#21)
- `applyOrder` / `applyOrderFilter` order by the database column of the field (`@Column({ name })`): `{ field: 'createdAt' }` with `@Column({ name: 'created_at' })` is ordered by `"created_at"`. Previously the property name was used and the query failed (`column user.createdAt does not exist`). An unquoted `alias.property` is still left to TypeORM, which maps it itself. (#26)
- Typed methods work before `from()`: on a query created without an entity (`dataSource.createQueryBuilder()`, `qb.subQuery()`), `alias.column` keys (`selectTyped<{ base: Message }>(q => q.base.chatRoomId)`) no longer throw TypeORM's `Main alias is not set`; a single-level key there throws a `TypeError` that says to call `from()` first. (#24)
- On UPDATE / DELETE, an `alias.column` key naming the main alias (`u => u.user.firstName`) gives the bare column `"firstName"`, like a single-level key; it used to give `"user"."firstName"`, which PostgreSQL rejects. (#24)
- `selectTyped` with an array of callbacks keeps `useQuotes`, and no longer changes a `KeyHolder` passed in; `orderByTyped` / `addOrderByTyped` honor `options.useQuotes` for a `KeyHolder` selection. (#24)
- String fields of the untyped methods (`whereIsIn` / `whereIsNotIn`, `whereIsAny`, array / JSON / distinct-from where methods, `applyPeriodFilter`, `orderByArrayPosition`) are resolved through the query's aliases: a column of an alias is quoted by the driver whatever its name (`'user.first-name'` → `"user"."first-name"`, also on UPDATE / DELETE as `"first-name"`), and `alias.property` is mapped to its column (`'user.createdAt'` → `"user"."created_at"`). Other fields use the driver's quotes, so MySQL / MariaDB get backticks instead of double quotes, which MySQL reads as strings. `tableHelper.column()` always quotes the column as one identifier. (#28)
- `GetManyWithTotalsOptions` includes the pagination options. `getManyWithTotals` already honored `useTakeAndSkip`, but its type didn't allow it, so TypeScript code couldn't page queries with joined collections correctly. (#29)

### Improvements

- Added `OrderEntity extends ObjectLiteral` constraint to `applyOrder` / `applyOrderFilter` generics.
- Added JSDoc documentation for all `tableHelper` methods.
- Added test coverage for `tableHelper`, typed key resolution (`getKey`), JSONB `whereTyped` conditions and `addValue` placeholder detection.
- Added `UserMetadata` typed JSONB column to test entity.
- Added `CLAUDE.md` project overview for AI-assisted development.
- The test suite passes on PostgreSQL as well as SQLite and no longer fails now and then: unique fake e-mails, id-independent order assertions, and a `distinctOn` test that never ran before. (#13)

### Internal

- Removed `getKeyPrefixAlias`, an internal helper added after 1.3.5. (#24)
- Removed the `Identifier` class (`src/utils/identifier.utils.ts`, never exported from the package); the order extension now builds identifiers with `tableHelper`.

## [1.3.5] - 2025-12-12

### Bug Fixes

- Refactored `where.utils.ts` to only add value when param is present (not `undefined`).

### Maintenance

- npm audit fix.

## [1.3.4] - 2025-12-12

### Maintenance

- Version bump. 1.3.3 was tagged but never published to npm, so 1.3.4 is the first npm release with the 1.3.3 changes below.

## [1.3.3] - 2025-12-12

> Not published to npm — these changes first shipped in 1.3.4.

### New Features

- **`isReversed` option for order** — added `isReversed` boolean to `OrderParam` type for toggling order direction.
- **`tableAlias` option** — added `tableAlias` to `OrderOptions` for custom alias support in order expressions.

### Improvements

- Narrowed `OrderParam` field type definition.
- Refactored alias assignment logic in `order.extension.ts`.
- Refactored direction handling for null value case.
- Improved test coverage.
- Added `whereTyped` options documentation.
- Upgraded Docusaurus and refactored docs deployment.
- Added `setupTest` utility for test infrastructure.

## [1.3.2] - 2025-05-25

### Improvements

- Refactored declarations merging and types.
- Added CI/CD pipelines: npm publish, lint, and test actions.
- Fixed declarations.
