---
sidebar_position: 2
---

# Reserved qualifier guard

## Description

An opt-in check of the SQL every query builder runs on PostgreSQL and CockroachDB: it reports a reserved word used as a qualifier without quotes, such as `order."userId"` or `user.id`, before the query reaches the database.

TypeORM quotes every alias it writes (`"order"`), and maps `alias.property` in conditions, selections, ORDER BY, GROUP BY and DISTINCT ON to the quoted column, but only for an alias with an entity and a property written unquoted under its own name. Everything else reaches the database as written. When the alias is a reserved word, PostgreSQL reads it as the key word, and the query fails:

```typescript
// ERROR: syntax error at or near "order"
orders.createQueryBuilder('order').where('order."userId" = :id', { id });

// `user` is the USER key word (CURRENT_USER): a syntax error too
users.createQueryBuilder('user').andWhere(`COALESCE(user."featureFlags" ->> 'beta', '') = 'on'`);
```

The same goes for a JSON path (`order.details->>'status'`, which TypeORM doesn't map), a raw subquery, and a table added with `.from(Entity, 'order')` but named `order."column"`. Such a query fails only when it runs, sometimes in a code path that tests don't reach, or inside a `catch` that hides the error. With the guard on, the query fails the same way in every environment, with an error that says which word and how to fix it:

```text
ReservedQualifierError: Reserved word used as a qualifier without quotes: "order" in …FROM "orders" "order" WHERE order."userId" = $1. PostgreSQL reads it as the key word, not as an alias, and rejects the query. Quote both halves, "order"."userId", or build the reference with tableHelper or the typed methods
```

```typescript
import { enableReservedQualifierGuard } from 'typeorm-extensions';

// at startup, or in the setup of the tests
enableReservedQualifierGuard();
```

The guard is off until `enableReservedQualifierGuard()` is called, and changes nothing else. A second call replaces the options; `disableReservedQualifierGuard()` turns it off again. It is exported from `typeorm-extensions/helpers` too, which installs no extension.

## What it checks

The SQL is checked where TypeORM builds the statement it sends: `getQueryAndParameters()`. Every query goes through it before it runs: `getMany`, `getOne`, `getRawMany`, `getRawOne`, `getCount`, `getManyAndCount`, `stream` and the other methods of `SelectQueryBuilder`, and `execute()` of insert, update, delete, soft delete and restore queries; `getSql()` too. A query that fails the check doesn't run: the method throws or rejects with the `ReservedQualifierError`. `getQuery()` isn't checked: the SQL of a subquery is checked as part of the query it goes into.

A word is reported when it is a reserved word, in any case, that is followed by a `.` (after optional whitespace) and isn't itself a name after a dot. Words inside string literals (`'…'`, `E'…'`, `$$…$$`, `$tag$…$tag$`), quoted identifiers, `--` and `/* */` comments (nested too) and parameters are skipped, and so is a number after a dot:

| SQL | Reported |
|---|---|
| `order."userId"`, `ORDER.id`, `user.id`, `group . name`, `order.*` | yes |
| `"order"."userId"`, `"order".id`, `orders.id`, `my_order.id` | no |
| `ORDER BY`, `GROUP BY`, `public.order.id`, `THEN .5` | no |
| `'order.id'`, `/* order.id */`, `:order` | no |

Only PostgreSQL, Aurora PostgreSQL and CockroachDB queries are checked; on other databases the guard does nothing, as their quoting and reserved words differ. Nothing is patched until the first `enableReservedQualifierGuard()`; after it, a disabled guard costs one check of a variable per query. The last SQL checked is remembered, so a query run again in a loop is scanned once (and still reported each time).

### The words

By default, the reserved key words of the database: PostgreSQL's (`POSTGRES_RESERVED_KEY_WORDS`, those "reserved" in Appendix C of its documentation, from `ALL` to `WITH`), CockroachDB's on CockroachDB (`COCKROACHDB_RESERVED_KEY_WORDS`: without `SYSTEM_USER`, with `CONCURRENTLY` and `CURRENT_SCHEMA`). None of them can name a table or an alias without quotes, so none is ever followed by a `.` in valid SQL.

PostgreSQL also has words "reserved (can be function or type)", such as `LEFT`, `RIGHT`, `JOIN` and `BINARY`. An alias can't be one of them without quotes either, but a type in a schema of that name can (`CAST(x AS binary.my_type)`), so they aren't on the list. `words` replaces the list; spread a default list to add to it:

```typescript
import { enableReservedQualifierGuard, POSTGRES_RESERVED_KEY_WORDS } from 'typeorm-extensions';

enableReservedQualifierGuard({ words: [...POSTGRES_RESERVED_KEY_WORDS, 'left', 'right'] });
```

## Signature

```typescript
enableReservedQualifierGuard(options?: ReservedQualifierGuardOptions): void
disableReservedQualifierGuard(): void

type ReservedQualifierGuardOptions = { words?: readonly string[] } & (
  | { mode?: 'throw' }
  | { mode: 'warn'; onViolation?: (violation: ReservedQualifierError) => void }
);

class ReservedQualifierError extends Error {
  readonly sql: string;
  readonly qualifiers: ReservedQualifier[];
}

findBareReservedQualifiers(sql: string, words?: readonly string[]): ReservedQualifier[]

interface ReservedQualifier {
  word: string;    // as the SQL has it: `order`, `ORDER`
  index: number;   // offset of the word in the SQL
  snippet: string; // the SQL around the word, on one line
}

const POSTGRES_RESERVED_KEY_WORDS: readonly string[];
const COCKROACHDB_RESERVED_KEY_WORDS: readonly string[];
```

## Arguments

- options.mode?: 'throw' | 'warn': `'throw'` (the default) makes the query throw or reject with a `ReservedQualifierError` before it runs. `'warn'` runs the query as it is and reports the error that `'throw'` would throw.
- options.onViolation?: (violation: ReservedQualifierError) => void: In `'warn'` mode, called with the error for each query that fails the check, e.g. to send it to a logger. Its stack points at the call that ran the query. By default the error goes to `console.warn`.
- options.words?: readonly string[]: The words to report, case-insensitive, instead of the default list. A word that isn't a key word (`'order.'`, `''`) throws a `TypeError`.

## Usage

```typescript
// in the tests: every query of the suite is checked, and fails with a message that names the word
beforeAll(() => enableReservedQualifierGuard());

// in production: report, don't fail
enableReservedQualifierGuard({
  mode: 'warn',
  onViolation: (violation) => logger.warn(violation.message, { sql: violation.sql }),
});
```

The fix is to quote both halves, or to let the library write the reference:

```typescript
const order = tableHelper<OrderEntity>('order');

orders
  .createQueryBuilder('order')
  .where('"order"."userId" = :id', { id })           // quoted by hand
  .andWhere(`${order.column('status')} <> :status`, { status: 'void' }) // "order"."status"
  .andWhereTyped((o) => o.total, '>', 0);             // "order"."total"
```

`findBareReservedQualifiers` is the check on its own, for SQL that doesn't come from a query builder:

```typescript
findBareReservedQualifiers(`SELECT * FROM orders "order" WHERE order.id = $1`);
// [{ word: 'order', index: 35, snippet: '…* FROM orders "order" WHERE order.id = $1' }]
```
