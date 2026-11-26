---
sidebar_position: 5
---

# Unbound parameter guard

## Description

An opt-in check of the SQL every query builder runs: it reports a `:name` or `:...name` parameter that has no value, before the query reaches the database.

TypeORM fills in a parameter only when it has a value for it: from the parameters of the condition that names it, or from `setParameter` / `setParameters`. A parameter it has no value for stays in the SQL as written, and the database rejects the query with a syntax error that doesn't name it:

```typescript
// ERROR: syntax error at or near ":"
users.createQueryBuilder('user').where('"user"."email" = :login');

// the condition names `login`, the parameters hold `email`
users.createQueryBuilder('user').where('"user"."email" = :login', { email });

// an update value written as SQL: TypeORM writes it as is
users.createQueryBuilder().update().set({ lastLoginAt: () => ':now' }).where('id = :id', { id });
```

Such a query fails only when it runs, sometimes in a code path that tests don't reach, or inside a `catch` that hides the error. With the guard on, it fails the same way in every environment, with an error that names the parameter:

```text
UnboundParameterError: Query parameter without a value: :login in …FROM "users" "user" WHERE "user"."email" = :login. TypeORM leaves a parameter it has no value for in the SQL as written, and the database rejects the query. Pass the value with the condition that names it, or call setParameter('login', value)
```

```typescript
import { enableUnboundParameterGuard } from 'typeorm-extensions';

// at startup, or in the setup of the tests
enableUnboundParameterGuard();
```

The guard is off until `enableUnboundParameterGuard()` is called, and changes nothing else. A second call replaces the options; `disableUnboundParameterGuard()` turns it off again. It is exported from `typeorm-extensions/helpers` too, which installs no extension.

## What it checks

The SQL is checked where TypeORM builds the statement it sends: `getQueryAndParameters()`, after TypeORM has filled in the parameters it has values for. Every query goes through it before it runs: `getMany`, `getOne`, `getRawMany`, `getRawOne`, `getCount`, `getManyAndCount`, `stream` and the other methods of `SelectQueryBuilder`, and `execute()` of insert, update, delete, soft delete and restore queries; `getSql()` too. A query that fails the check doesn't run: the method throws or rejects with the `UnboundParameterError`. `getQuery()` isn't checked: it has no values filled in yet, and the SQL of a subquery is checked as part of the query it goes into.

A parameter is a `:` followed by a name that TypeORM would fill in: a letter or `_`, then letters, digits, `_` and `.`; `:...name` is a list. The SQL is read as the database reads it, so a `:` in a literal, a quoted name or a comment is not a parameter:

| SQL | Reported |
|---|---|
| `= :login`, `IN (:...ids)`, `ARRAY[:first]`, `= :user_id` | yes |
| `x::text`, `geography::Point(…)` (casts) | no |
| `':literal'`, `E'\':escaped'`, `$$:dollar$$`, `"a:b"`, `/* :comment */`, `-- :comment` | no |
| `= :1` (Oracle's own parameters) | no |
| `tags[1:n]`, `tags[:n]` (PostgreSQL slices) | no |

How the SQL is read depends on the database:

- PostgreSQL, Aurora PostgreSQL, CockroachDB: `'…'` and `E'…'` strings, dollar-quoted strings (`$$…$$`, `$tag$…$tag$`), `"…"` names, nested `/* */` comments. A `:name` inside a subscript (`tags[…]`, `(…)[…]`) is a slice bound, not a parameter; inside `ARRAY[…]` it is a parameter.
- MySQL, MariaDB, Spanner: `'…'` and `"…"` strings with backslash escapes, `` `…` `` names, `#` comments too.
- SQLite, SQL Server, Oracle, SAP HANA and the others: `'…'` strings, `"…"`, `` `…` `` and `[…]` names.

MongoDB queries aren't checked. Nothing is patched until the first `enableUnboundParameterGuard()`; after it, a disabled guard costs one check of a variable per query. The last SQL checked is remembered, so a query run again in a loop is scanned once (and still reported each time).

Only the SQL of query builders is checked: `dataSource.query(sql, parameters)` and `queryRunner.query` take the database's own placeholders (`$1`, `?`), which TypeORM doesn't fill in.

## Signature

```typescript
enableUnboundParameterGuard(options?: UnboundParameterGuardOptions): void
disableUnboundParameterGuard(): void

type UnboundParameterGuardOptions =
  | { mode?: 'throw' }
  | { mode: 'warn'; onViolation?: (violation: UnboundParameterError) => void };

class UnboundParameterError extends Error {
  readonly sql: string;
  readonly parameters: UnboundParameter[];
}

findUnboundParameters(sql: string, driver?: DatabaseType): UnboundParameter[]

interface UnboundParameter {
  name: string;    // without the `:` / `:...`: `login`
  spread: boolean; // written as a list, `:...ids`
  index: number;   // offset of the `:` in the SQL
  snippet: string; // the SQL around the parameter, on one line
}
```

## Arguments

- options.mode?: 'throw' | 'warn': `'throw'` (the default) makes the query throw or reject with an `UnboundParameterError` before it runs. `'warn'` runs the query as it is and reports the error that `'throw'` would throw.
- options.onViolation?: (violation: UnboundParameterError) => void: In `'warn'` mode, called with the error for each query that fails the check, e.g. to send it to a logger. Its stack points at the call that ran the query. By default the error goes to `console.warn`.

## Usage

```typescript
// in the tests: every query of the suite is checked, and fails with a message that names the parameter
beforeAll(() => enableUnboundParameterGuard());

// in production: report, don't fail; the database would reject the query anyway
enableUnboundParameterGuard({
  mode: 'warn',
  onViolation: (violation) => logger.warn(violation.message, { sql: violation.sql }),
});
```

The fix is to pass the value under the name the SQL uses:

```typescript
users
  .createQueryBuilder('user')
  .where('"user"."email" = :login', { login: email })
  .andWhere('"user"."id" IN (:...ids)')
  .setParameter('ids', ids);
```

`findUnboundParameters` is the check on its own, for SQL that TypeORM has already filled in, such as the output of `getSql()`. The database decides how literals and comments are read; PostgreSQL by default:

```typescript
findUnboundParameters(`SELECT * FROM "users" "user" WHERE "user"."email" = :login`);
// [{ name: 'login', spread: false, index: 52, snippet: '…WHERE "user"."email" = :login' }]

findUnboundParameters('SELECT "a :b" FROM t WHERE a = :c', 'mysql');
// [{ name: 'c', … }]: "a :b" is a string on MySQL
```
