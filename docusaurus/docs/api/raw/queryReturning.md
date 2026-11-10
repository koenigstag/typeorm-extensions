---
sidebar_position: 1
---

# queryReturning

## Description

Runs a raw statement and resolves `{ records, affected }`: the rows it returned and the row count it touched, in the same shape whatever the statement and the driver.

`query()` shapes its result by the command instead. On PostgreSQL an UPDATE or a DELETE resolves to `[rows, rowCount]`, while a SELECT or an INSERT resolves to the rows:

```typescript
// INSERT … RETURNING: the first row
const [created] = await dataSource.query('INSERT INTO "tickets" … RETURNING *');

// UPDATE … RETURNING: the rows array, not a row. It is truthy, so the check passes,
// and every field of it reads undefined
const [updated] = await dataSource.query('UPDATE "tickets" SET … RETURNING *');
if (!updated) throw new Error('not found');
```

`queryReturning` reads both halves from TypeORM's structured result, which every driver fills the same way:

- `records`: the rows of a SELECT or of a `RETURNING` clause, `[]` when there are none;
- `affected`: the row count the driver reports, `null` when it reports none. SQLite reports none for a statement that returns rows.

TypeORM 0.3's runner of the `sqlite` (sqlite3) driver reads no rows from a statement that starts with `INSERT`, `UPDATE` or `DELETE`, so its `RETURNING` rows were lost; `queryReturning` sends such a statement after a line break, which the runner reads rows from.

On an entity manager bound to a query runner — inside `dataSource.transaction`, or a transactional manager — the statement runs on that runner, so it stays in the transaction. Otherwise it gets a query runner of its own and releases it.

Available on `DataSource`, `EntityManager` and `Repository`.

## Signature

```typescript
queryReturning<Row = ObjectLiteral>(
  query: string,
  parameters?: unknown[]
): Promise<QueryReturningResult<Row>>

interface QueryReturningResult<Row> {
  records: Row[];
  affected: number | null;
}
```

## Arguments

- query: string: The SQL, with the placeholders of the driver (`$1` on PostgreSQL, `?` on MySQL and SQLite).
- parameters: unknown[]: Values for the placeholders.

## Usage

```typescript
// the updated row, or none
const { records: [ticket] } = await manager.queryReturning<{ id: number; status: string }>(
  'UPDATE "tickets" SET "status" = $1 WHERE "id" = $2 RETURNING "id", "status"',
  ['closed', ticketId]
);

if (!ticket) {
  throw new NotFoundException();
}
```

```typescript
// how many rows a statement changed
const { affected } = await dataSource.queryReturning(
  'UPDATE "tickets" SET "status" = $1 WHERE "status" = $2',
  ['closed', 'open']
);
```
