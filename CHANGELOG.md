# Changelog

## [2.2.0] - Unreleased

Published for testing as `2.2.0-rc.8` under the `next` dist-tag: `npm install typeorm-extensions@next`.

A minor version, which also carries the MIT license prepared for 2.1.1: 2.1.1 was never published. Code that reads the results needs no change. Code that builds a `ListWithTotals` or a `ListWithCursor` itself (a mock, a wrapper) has to add `hasMore`, `pageSize` and `orderBy`, and `page` for `ListWithTotals`. Without a query runner of its own, `getManyWithTotals` now holds two pool connections for the length of the call instead of one.

One change can make working code throw: a params object that goes after the condition (`whereTyped(u => u.id, '=', { id })`) has to hold exactly one key, see **Bug Fixes**.

### New Features

- **`hasMore` on both paginated results**: `getManyWithTotals` returns `offset + list.length < total`, and with `disableTotalsCalculation` reads the page one row longer instead of counting — the extra row is dropped from `list` and only answers `hasMore`, so no `COUNT` query runs and the flag is still known. `null` only with `loadAll`, where the page is every row. `getManyWithCursor` returns a boolean the same way, from the `pageSize + 1` rows its keyset query already loads.
- **`orderBy` on both paginated results**: the ORDER BY the page was read in, as `OrderType[]`, for logs and debugging. For `getManyWithTotals` these are SQL selectors (`"user"."created_at"`, a generated `array_position_…` alias, a raw expression), not properties of the entity. Without an explicit order it is the `orderBy` of `@Entity`, like the SQL; empty with the `disable-global-order` option. `getManyWithCursor` returns its `orderBy` columns followed by the appended primary key, as `alias.property` (`user.createdAt`): the order its cursors encode.
- **`page` and `pageSize` on both paginated results**: the values the page was read with, after the defaults. `getManyWithTotals` returns `page: 1` for a missing page or one below 1 and `pageSize: 10` for a missing size or one below 1, and `null` for both with `loadAll`; `getManyWithCursor` returns the `pageSize` rounded down, `10` when it was missing or below 1. A response can pass them on without repeating the defaults of the library. `applyPaginationFilter`, `getManyWithTotals`, `getRawManyWithTotals` and `getManyWithCursor` read a numeric string, such as an unparsed query parameter `'20'`, as a number and round a fraction down, so the results hold numbers; with `disableTotalsCalculation`, `pageSize: '20'` no longer reads `'20' + 1` = 201 rows.
- **`getRawManyWithTotals`**: `getManyWithTotals` for raw rows, with the same result (`total`, `hasMore`, `orderBy`), concurrency and options except `useTakeAndSkip`: raw rows are paged with LIMIT / OFFSET. `total` counts the rows the query returns: the query is counted as a subquery, `SELECT COUNT(*) FROM (query)`, so a grouped query counts its groups and HAVING applies. `countExpression` counts with an expression instead (`COUNT(DISTINCT "order"."user_id")`), without GROUP BY and HAVING.
- **`typed<Root>()`** sets the root of the typed callbacks once for a query, instead of passing it to each call (`whereTyped<Joins>(…)`): `query.typed<{ checkin: CheckIn; event: Event }>().whereTyped((q) => q.event.eventType, '=', type)`. Type-only; the root carries through the chain, TypeORM's methods and this library's included, and `getMany()` still returns the entities. With `strictParams` the parameters of these calls are checked, which an explicit type argument turns off. It marks the builder, not its entity: it returns `WithTypedRoot<SelectQueryBuilder<Entity>, Root>`, and the typed methods' default root is `TypedRoot<Entity, this>`, the root of that mark, else the entity. The marked builder goes wherever the unmarked one does: a `SelectQueryBuilder<ObjectLiteral>` parameter, a helper generic over the entity (`<T>(qb: SelectQueryBuilder<T>)` infers `T` as the entity), and a cast that compiles without the mark, such as `dataSource.createQueryBuilder().typed<Joins>() as SelectQueryBuilder<Row>`. A helper generic over the entity can call `typed()` itself and return the builder as its `SelectQueryBuilder<T>`. It works on a `SelectQueryBuilder<any>` too, and declaration files (`declaration: true`) name a marked builder by `WithTypedRoot`. A builder of a marked entity, `SelectQueryBuilder<WithTypedRoot<Entity, Root>>`, takes the root too. The methods of this library that returned `SelectQueryBuilder<Entity>` on a select query (`selectTyped`, `orderByTyped`, the typed joins, `distinctOnTyped`, `whereIsIn` / `whereIsAny` and their variants, `applyOrder`, `applyPaginationFilter`) return `this`, so the mark carries through them. `from()` and `addFrom()` keep the root, so it may go before them (`dataSource.createQueryBuilder().typed<Joins>().from(CheckIn, 'checkin')`); a subquery starts without it; a second call replaces the root.
- **`groupByTyped` / `addGroupByTyped`**: GROUP BY with typed callbacks on `SelectQueryBuilder`. One callback may select several columns (`user => [user.id, user.email]`), and columns of joined relations work too. Like `orderByTyped`, the key is `alias.property`, which TypeORM maps to the column, or with `useQuotes` the quoted database column, which a subquery in FROM needs. A JSON column groups as a whole (`jsonb` on PostgreSQL), while a path into one throws a `TypeError`, as in select, order and distinct. The callback starts at the root set with `typed<Root>()`, else at the entity.
- **`havingTyped` / `andHavingTyped` / `orHavingTyped`**: HAVING on an aggregate of a typed property, `havingTyped('COUNT', u => u.images.id, '>=', 2)`. `COUNT`, `COUNT DISTINCT`, `SUM`, `AVG`, `MIN`, `MAX`, and `'*'` for `COUNT(*)`. Parameters as in `whereTyped`; with `strictParams` the value is a number for counts, sums and averages and the column's value for `MIN` / `MAX`. The callback starts at the root set with `typed<Root>()`, else at the entity.
- **`leftJoinAndMapOneTyped` / `innerJoinAndMapOneTyped` / `leftJoinAndMapManyTyped` / `innerJoinAndMapManyTyped`**: TypeORM's map joins with the property to map to picked by a typed callback instead of an `'alias.property'` string: `leftJoinAndMapOneTyped((u) => u.profile, Profile, 'profile', 'profile.userId = user.id')` is `leftJoinAndMapOne('user.profile', …)`. The property may be any property of the root, a relation or one declared for the mapped data; with an alias-keyed root, `(q) => q.photo.owner` is `'photo.owner'`, a property of a joined alias. The joined data is what TypeORM's methods take: an entity, a relation, a table name or a subquery factory; TypeORM's `mapAsEntity` isn't passed on. The callback starts at the root set with `typed<Root>()`, else at the entity.
- **`whereNotExists` / `andWhereNotExists` / `orWhereNotExists`**, and `whereExists` / `andWhereExists` / `orWhereExists` on update, delete and soft delete / restore queries: TypeORM has `EXISTS` on `SelectQueryBuilder` only, and no `NOT EXISTS`. The SQL is TypeORM's, so `NOT EXISTS` is the negation of its `whereExists`, except with a HAVING in the subquery: its GROUP BY stays, where TypeORM drops it and the HAVING then aggregates the whole subquery. A method is added only where the builder lacks it: TypeORM's own `whereExists` stays. The subquery's parameters get unique names, so two subqueries that both use `:status` keep their own values; with TypeORM's `whereExists` the value set last wins.
- **`whereRelationExists` / `whereRelationNotExists`** (and `and…` / `or…`): `EXISTS` / `NOT EXISTS` over a relation picked by a typed callback, with the join condition from the relation's metadata: one-to-many, many-to-one, one-to-one and many-to-many through the junction table. A callback narrows the related rows; the join condition is added after it and can't be dropped or bypassed by its `where` / `orWhere`. Subquery parameters get unique names. The callback starts at the root set with `typed<Root>()`, else at the entity.
- **`timeZone` in `applyPeriodFilter` / `applyPeriodFilterTyped`**: reads a date (`'2024-01-31'`) and a date-time without an offset (`'2024-01-31 10:00'`) as the wall clock of an IANA time zone, so a period of days is the user's days: `{ periodFrom: '2024-01-01', periodTo: '2024-01-31' }` in `America/New_York` is `>= 2024-01-01T05:00Z AND < 2024-02-01T05:00Z`. Converted in JavaScript (`Intl`), so the column stays bare in SQL and keeps its index, on every database; daylight saving time as PostgreSQL's `AT TIME ZONE` handles it. `Date`s stay as they are, strings with an offset (`Z`, `+02:00`) become that instant, other strings and unknown zones throw a `TypeError`.
- **`leftJoinLateral` / `innerJoinLateral`**: `LEFT JOIN LATERAL` and `INNER JOIN LATERAL`, which TypeORM doesn't have, with a query builder, a factory or raw SQL as the subquery and `ON TRUE` by default. A query builder's or a factory's parameters get unique names, so a `:status` in the subquery doesn't clash with one in the outer query. They go through TypeORM's own subquery-join path. PostgreSQL, CockroachDB, MySQL 8.0.14+ and Oracle.
- **`innerJoinUnnest(field, array, arrayType?)`**: keeps the rows whose column is in an array by joining `SELECT DISTINCT unnest(CAST(:array AS type[]))`, the same rows as `whereIsAny` with a plan that can start from the array. The array type defaults to the array of the column's type; it is required for a field that isn't an entity column and for an enum column. An empty array matches no row. PostgreSQL and CockroachDB.
- **`fromUnion` / `addCommonTableExpressionUnion`**: a UNION (or `UNION ALL`) of query builders as the FROM of a query or as a common table expression. The parameters of each part get unique names: pasting `getQuery()` and merging `getParameters()` lets two parts with a `:status` each read the last value, without an error. Raw SQL parts read the outer builder's parameters. On SQLite a part with an ORDER BY or a LIMIT, as of an entity's default `orderBy`, is wrapped in `SELECT * FROM (…)`, and the others stay bare, so a recursive CTE works there too. A part built with `subQuery()` goes in without the parentheses it writes around itself, which SQLite rejects in a UNION.
- **`@GeneratedColumn`**: `@Column` for a column the database computes (`GENERATED ALWAYS AS (…) STORED`), with `insert` and `update` off. A plain `@Column` over such a column sends whatever the entity holds in `save`, `insert` and `update`, and the database rejects it; `asExpression` only describes the column for schema sync and doesn't stop that, in TypeORM 0.3 or 1.x. Every other column option applies (`select: false`, `name`, and `asExpression` / `generatedType` for schema sync); `insert`, `update` and `readonly` aren't accepted. Exported from the package root and from `typeorm-extensions/helpers`. The docs compare it with `@CalculatedColumn` and TypeORM's `@VirtualColumn`, with a use case for each.
- **`@CalculatedColumn` and `addSelectCalculated`**: an entity property that a query fills with an SQL expression of its own. The decorator declares no column of the table (schema sync leaves it out, it is never inserted or updated, and TypeORM never selects it by itself); `addSelectCalculated(expression or subquery, property, alias?)` selects into it under the key TypeORM hydrates from, with the property checked against the entity type. The value is converted by the property's type, so a `number` turns a PostgreSQL `COUNT` or an `AVG` into a number with its decimals, and a `boolean` reads `0` / `'0'` as false on every database. Unlike TypeORM's `@VirtualColumn`, it costs nothing until a query asks for it. It is a TypeORM virtual property, with their limits in older TypeORM versions: schema sync before 0.3.29 keeps the removed columns of its table, and `upsert` on TypeORM 0.3 fails with the property set; the docs list them.
- **`orderByCalculated` / `addOrderByCalculated`**: order by the value of a `@CalculatedColumn` selected with `addSelectCalculated`, also with `take` / `skip` and joins. `applyOrder` does the same for a `field` that is a `@CalculatedColumn`, so a client can sort by it like by any column. The value is selected a second time under a generated `calculated_…` alias, which PostgreSQL and the DISTINCT query of a paged join can order by.
- **`addSelectCalculatedTyped` / `orderByCalculatedTyped` / `addOrderByCalculatedTyped`**: `addSelectCalculated` and `orderByCalculated` with the property picked by a typed callback, `(user) => user.imagesCount`, or `(q) => q.owner.imagesCount` for the entity of a joined alias, which the callback names. The callback starts at the root set with `typed<Root>()`, else at the entity, so the property of a joined entity is checked at compile time too, where the string form takes any name. That it is a `@CalculatedColumn` is checked when the query is built, as for the string form.
- **`tableHelper` `jsonBuildObject` and `jsonAgg`**: a JSON object of columns, as a list or a `{ key: column }` map checked against the entity type, and a JSON array aggregate with `orderBy` (a column of the entity), `filter` and `[]` for a group without rows. PostgreSQL's `json_build_object` / `json_agg` (`jsonb` on request), MySQL's `JSON_OBJECT` / `JSON_ARRAYAGG` and SQLite's `json_object` / `json_group_array`, by the helper's `driver`.
- **`tableHelper` `sum` and `arrayAgg`**: `COALESCE(SUM(column), 0)` for a column whose property is a number, with `filter` written as `CASE` or `FILTER` like `count`; and a PostgreSQL `array_agg` of a column with `distinct`, `orderBy` and `filter`, `{}` for a group without rows. Other databases have no arrays: `arrayAgg` throws a `TypeError` with their `driver`.
- **`tableHelper` `atTimeZone` and `dateTrunc`** (PostgreSQL): `(value AT TIME ZONE zone)` and `date_trunc('unit', value[, zone])`, the zone given as an escaped literal, a column of the table with a `NULL` fallback, or SQL. An ISO 8601 offset is east of UTC, `'+02:00'` = UTC+2: PostgreSQL reads a bare one as a POSIX zone, the other way round, so it is written as `'<+0200>-02:00'`. An offset past `±23:59` (`'+25:00'`) throws a `TypeError`, as in `applyPeriodFilter`. The `date_trunc` unit is checked.
- **`tableHelper(Entity, alias?, options?)`**: given the entity class instead of a type argument, the helper takes the type from it and writes the database column of each property: `tableHelper(User, 'user').adminEmail` is `"user"."email"` for `@Column({ name: 'email' }) adminEmail`, in `column()`, the column properties and every method built on them. The names come from the `name` of the column decorators on the class and its parents (the nearest wins), read once per class from TypeORM's metadata storage, so no `DataSource` is needed. Other columns keep their property names, as under the default naming strategy; a custom naming strategy and embedded columns are not applied. `tableHelper<Entity>(alias)` is unchanged.
- **Columns as properties of `tableHelper`**: `t.email` gives what `t.column('email')` gives, with the same alias and options, for each key of the entity or row type (`tableHelper<Record<'utm_id' | 'total', unknown>>('cte').utm_id` is `"cte"."utm_id"`); an unknown name doesn't compile. The members of the helper win: a column named `alias`, `count`, `where`, … is reachable through `column()` only. Symbols and the keys that JavaScript and test tools read on any object (`then`, `toJSON`, `inspect`, `asymmetricMatch`, `$$typeof`, `nodeType`, the members of `Object.prototype`) aren't columns, so `await`, `JSON.stringify`, `String()`, `util.inspect` and Jest matchers treat the helper as a plain object. The helper is a `Proxy` around the object it was, and its type is exported as `TableHelper<Entity>`.
- **`queryReturning` on `DataSource`, `EntityManager` and `Repository`**: runs a raw statement and resolves `{ records, affected }`, the same shape for every statement and driver. `query()` shapes its result by the command: on PostgreSQL an UPDATE or a DELETE resolves to `[rows, rowCount]` while a SELECT or an INSERT resolves to the rows, so taking the first element of an UPDATE … RETURNING yields the rows array instead of a row. On a manager bound to a query runner the statement runs on it, inside its transaction. On TypeORM 0.3's sqlite3 driver, whose runner reads no rows from an INSERT, UPDATE or DELETE, the `RETURNING` rows are read too.
- **`enableReservedQualifierGuard` / `disableReservedQualifierGuard`**: an opt-in check of the SQL every query builder runs on PostgreSQL and CockroachDB, for a reserved word used as a qualifier without quotes: `order."userId"`, `user.id`, `COALESCE(user."featureFlags" ->> 'x', '')`. TypeORM quotes the aliases it writes and maps `alias.property` only for an alias with an entity and an unquoted property, so such a word comes from SQL written by hand, which PostgreSQL rejects (`syntax error at or near "order"`; `user` is the `USER` key word). The check sits in `getQueryAndParameters()`, which every query passes before it runs (`getMany`, `getRawMany`, `getOne`, `getCount`, `stream`, `execute()` of insert, update, delete, soft delete and restore queries, and `getSql()`). In `'throw'` mode, the default, the query throws or rejects with a `ReservedQualifierError` that names the word, shows the SQL around it and the quoted reference; in `'warn'` mode it runs, and the error goes to `onViolation`, `console.warn` by default. Words in string literals (`E'…'` and dollar-quoted ones too), quoted identifiers, comments and parameters are skipped. The words are PostgreSQL's reserved key words (`POSTGRES_RESERVED_KEY_WORDS`; CockroachDB's on CockroachDB), which `words` replaces. Off until enabled: nothing is patched before the first call, and other databases aren't checked. `findBareReservedQualifiers(sql, words?)` is the check on its own; all of them are exported from `typeorm-extensions/helpers` too.

### Improvements

- **Licensed under MIT, and the package ships the license text**: `package.json` said ISC, but there was no `LICENSE` file in the repository or the npm package. From 2.2.0 on the license is MIT, with the text in `LICENSE`; versions up to 2.1.0 stay ISC.
- **`whereIsIn` / `whereIsAny` and their variants return `this` on every builder**: on update, delete and soft delete builders they were declared to return `UpdateQueryBuilder<Entity>` and the like, which dropped the mark of `typed<Root>()`; they are declared once now, as the other where methods are (`WhereIsInMethods`, `WhereIsAnyMethods`).
- **`getManyWithTotals` runs its count and its page query at the same time**, so the call takes as long as the slower one instead of their sum. The count goes on a clone of the builder, taken before the page query applies its limit. On a builder bound to a query runner — from a transactional manager, or inside `dataSource.transaction` — the two still run one after another: there is a single connection, on which the driver would serialise them anyway.
- **`tableHelper` takes a `driver` option**: `tableHelper('user', { driver: 'mysql' })` quotes with backticks.

### Bug Fixes

- **`leftJoinTyped` and the other typed joins given a string join it**: from untyped code, a string in place of the callback added no join and returned the builder as it was. It is joined as written now, as the typed map joins already did.
- **A `KeyHolder` in `selectTyped`, `orderByTyped` and `addOrderByTyped` is read like a callback**: a single one wrote its keys without the main alias and, with `useQuotes`, the property name instead of the column of a renamed `@Column({ name })`; in an array it got the alias but still the property name. Both now go through the key resolution of the callbacks: the main alias, the database column when quoted, an alias added later resolved when the SQL is built, and a key deeper than `alias.column` throws a `TypeError` instead of being cut to two levels.
- **A params object whose value goes after the condition takes one key**: `whereTyped(u => u.id, '=', { id: 1, email })` used the first value and dropped the others without a word, and `{}` compared the column with `NULL`. Both now throw a `TypeError`. Objects whose keys the condition names (`'BETWEEN :from AND :to'`) and `addValue: false` are as before.
- **Identifiers quoted for MySQL / MariaDB**: `applyOrder` / `applyOrderFilter`, and `orderByTyped` / `addOrderByTyped` / `selectTyped` with `useQuotes`, put double quotes around column names on every database. On MySQL a double-quoted name is a string, so ordering by `"ticket_status"` ordered by a constant and returned the rows in no particular order without an error, and `"t"."ticket_id"` was a syntax error. They now quote with backticks there. The test suite runs on MySQL 8.4 in CI.
- **`getManyWithTotals` with a cache id read the count and the page from one cache entry**: with `.cache('id', ms)` the count ran under the page query's id, so every call after the first got the other query's cached rows: an empty `list`. The count is now cached under `<id>-count`, as TypeORM's `getManyAndCount` does; `getRawManyWithTotals` does the same, and its default count subquery is cached too.
- **`getManyWithTotals` no longer returns with a query in flight when the other one fails**: with the count and the page running at the same time, `Promise.all` rejected as soon as one failed, while the other kept running on its pooled connection and its outcome was dropped. The call now waits for both and then rejects with the first error, the count's if both failed. A page that fails before its query starts, on a limit TypeORM rejects, waits for the count too.
- **`whereArrayContainsTyped` / `ContainedByTyped` / `OverlapsTyped` on an array inside a JSON column**: the path was read as text and compared with an array operator, an error in the database. It is now compared with jsonb operators: `@>` and `<@` against the values as a JSON array, and `?|` for an overlap of strings, on arrays only: a string or an object at the path doesn't match.
- **`orderByArrayPositionTyped` on a value inside a JSON column** compared the value as text: a stored `3.0` didn't match `3`, and with `arrayType: 'int[]'` the query failed. The value is now cast to the type of the values, as typed where methods do; a value of another JSON type goes last instead of failing the cast.
- **`tableHelper.count()` on MySQL**: `CAST(COUNT(…) AS integer)` is a syntax error there. With `driver: 'mysql'` it casts `AS SIGNED`.
- **Column names inside `Brackets` and subqueries**: the builder TypeORM passes to a `Brackets` callback has the outer query's main alias but none of its aliases, so typed keys there kept the property name: `where.whereTyped((o) => o.calculatedAmount, …)` gave `"o"."calculatedAmount"` instead of the `@Column({ name: 'calculated_amount' })` column, an error in the database; the same for a joined alias (`j.u.fullName`) and for string fields (`whereIsIn('u.fullName', …)`). In a subquery, an alias of the outer query had the same problem. Aliases are now looked up in the queries the builder is part of too.
- **Typed select / order / group by / distinct on an alias without metadata**: without `useQuotes`, `orderByTyped` / `addOrderByTyped`, `selectTyped` / `addSelectTyped`, `groupByTyped` / `addGroupByTyped` and `distinctOnTyped` gave `alias.property` for every alias. TypeORM maps that to the column only for an alias with metadata; for a subquery or a table in FROM or a join that isn't an entity (`.from('recent_events', 'recentEvents')`) it stays as written, and PostgreSQL folds the unquoted `recentEvents.startsAt` to `recentevents.startsat`: `missing FROM-clause entry for table "recentevents"`. Keys of such an alias are now quoted, as typed where methods already did, also when the alias is added after the call (`.selectTyped(…).from(subQuery, 'pairs')`) or never: an alias that only raw SQL adds, such as a `LATERAL` subquery in the condition of a raw join, is quoted when the SQL is built. `useQuotes: false` keeps them unquoted in the methods that take it. A column that raw SQL names without quotes (`SELECT id AS userId`) is `userid` on PostgreSQL, so a camelCase key for it (`cte.userId`), which used to match after folding, now doesn't: quote the column name in the SQL (`AS "userId"`), or pass `useQuotes: false`.
- **Typed keys on an alias added after the call**: typed where methods, and select / order / group by with `useQuotes`, mapped the property to its column through the aliases the query had when the method was called. Before the join that adds the alias, `whereTyped((j) => j.usr.receiptsEmail, …)` kept the property name, `"usr"."receiptsEmail"`, instead of the `@Column({ name: 'receipts_email' })` column; the same for string fields (`whereIsIn('usr.receiptsEmail', …)`). Such keys are now resolved when TypeORM builds the SQL, as it does for unquoted keys. An alias that is still unknown then, or has no metadata, keeps the property name as before.
- **Typed select / order / group by / distinct on a relation without a join column or an embedded entity** (`user => user.images`, `person => person.address`) built SQL the database rejects. They now throw a `TypeError`. A many-to-one relation still selects its join column.
- **A typed where with an `undefined` value after an operator**: `whereTyped((u) => u.email, '=', undefined)` gave `"user"."email" =`, a syntax error in the database. It now throws a `TypeError` that names the condition. A condition that ends with a parameter set later (`'ILIKE :like'` with `setParameter`) is unaffected, and `null` and `{ email: undefined }` compare with `NULL`, as before.
- **Where methods on soft delete and restore queries**: `whereIsIn`, `whereIsAny`, `whereArrayContains`, `whereJsonContains`, `whereIsDistinctFrom`, `applyPeriodFilter`, their `and…` / `or…` / `…Not…` forms and their typed variants (`whereTyped`, `whereIsAnyTyped`, `whereILikeTyped`, …) were added to select, update and delete queries only: `createQueryBuilder().softDelete().whereIsAnyTyped(…)` threw `… is not a function`. They are now on `SoftDeleteQueryBuilder` too, which `softDelete()` and `restore()` return, with the SQL they give on an update.
- **A query builder of an entity didn't compile as a `SelectQueryBuilder<ObjectLiteral>` under the root import**: `getManyWithCursor`, which `import 'typeorm-extensions'` loads, took the entity's property names in its `options`, which made the builder invariant in its entity: a `SelectQueryBuilder<User>`, and the builder `typed()` returns, was no `SelectQueryBuilder<ObjectLiteral>` argument (TS2345), and didn't cast to the builder of rows it has the columns of (`as SelectQueryBuilder<{ email: string }>`, TS2352). `getManyWithCursor` is now generic over the entity of the builder it is called on, which it infers: `orderBy` still takes that entity's properties, and `list` is still its entities.

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
