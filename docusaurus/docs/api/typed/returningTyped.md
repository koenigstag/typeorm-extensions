---
sidebar_position: 7
---

# returningTyped

## Description
`returningTyped` sets what an INSERT, UPDATE or DELETE returns, as an object of output names: `RETURNING` on PostgreSQL and MariaDB, `OUTPUT` on SQL Server (the databases TypeORM supports it for).

- The callback gets the columns of the written row. A property gives its column, whatever its database name (`@Column({ name })`); embedded properties (`p => p.address.city`) and relations with one join column (`i => i.user`) work too.
- A value of the returned object is a column or an SQL expression built from them (`` `${t.status} = 'done'` ``). The key is the output name, so the rows in `execute()`'s `raw` are `{ id, status }` whatever the column names.
- On PostgreSQL 18+ the callback also gets `old` and `new`: the row before and after the write. `old` is all `NULL` for an inserted row, `new` for a deleted one. On other databases they throw a `TypeError`. A column named `old` or `new` is shadowed by them.
- Exactly the listed outputs are returned: TypeORM doesn't add the generated columns of an INSERT, as with its `returning('…')` string.
- A property that isn't a column, a list, an empty object, or a value that is neither a column nor a string throws a `TypeError`.

Available on `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder`. On other databases (SQLite, MySQL) it throws TypeORM's `ReturningStatementNotSupportedError`, like `returning`.

## Signature
```typescript
returningTyped<Type = Entity>(selection: (columns: ReturningColumns<Type>) => Record<string, string>): this
```

## Arguments
- selection: a callback that gets the columns of the written row (and `old` / `new`) and returns an object of output names.

## Usage

```typescript
// UPDATE "tickets" SET … WHERE … RETURNING "ticket_id" AS "id", "ticket_status" AS "status"
const { raw } = await repository
  .createQueryBuilder()
  .update()
  .set({ status: 'closed' })
  .where('owner_id = :ownerId', { ownerId })
  .returningTyped(ticket => ({ id: ticket.id, status: ticket.status }))
  .execute();

// raw: [{ id: 1, status: 'closed' }, …]
```

```typescript
// ids of the deleted rows
const { raw } = await repository
  .createQueryBuilder()
  .delete()
  .applyPeriodFilterTyped(log => log.createdAt, { periodTo: yearAgo }, { includeTo: false })
  .returningTyped(log => ({ id: log.id }))
  .execute();
```

```typescript
// PostgreSQL 18+: the value before the write, and whether it changed
// … RETURNING old."ticket_status" AS "before", old."ticket_status" IS DISTINCT FROM new."ticket_status" AS "changed"
const { raw } = await repository
  .createQueryBuilder()
  .update()
  .set({ status: 'closed' })
  .where('owner_id = :ownerId', { ownerId })
  .returningTyped(({ old, new: next }) => ({
    before: old.status,
    changed: `${old.status} IS DISTINCT FROM ${next.status}`,
  }))
  .execute();
```
