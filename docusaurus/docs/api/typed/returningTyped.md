---
sidebar_position: 7
---

# returningTyped

## Description
`returningTyped` sets the columns returned by an INSERT, UPDATE or DELETE from entity properties: `RETURNING` on PostgreSQL and MariaDB, `OUTPUT` on SQL Server (the databases TypeORM supports it for).

- Properties are mapped to their columns, whatever their database names (`@Column({ name })`); embedded properties (`p => p.address.city`) and relations with a join column (`i => i.user`) work too.
- A property that isn't a column throws a `TypeError`. TypeORM's own `returning(['…'])` silently skips unknown names.
- The returned rows are in `execute()`'s `raw`, keyed by database column name.

Available on `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder`. On other databases (SQLite, MySQL) it throws TypeORM's `ReturningStatementNotSupportedError`, like `returning`.

## Signature
```typescript
returningTyped(selection: KeyProxyCallback<Entity>): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one property or an array of them.

## Usage

```typescript
// UPDATE "tickets" SET … WHERE … RETURNING "ticket_id", "ticket_status"
const { raw } = await repository
  .createQueryBuilder()
  .update()
  .set({ status: 'closed' })
  .where('owner_id = :ownerId', { ownerId })
  .returningTyped(ticket => [ticket.id, ticket.status])
  .execute();

// raw: [{ ticket_id: 1, ticket_status: 'closed' }, …]
```

```typescript
// ids of the deleted rows
const { raw } = await repository
  .createQueryBuilder()
  .delete()
  .applyPeriodFilterTyped(log => log.createdAt, { periodTo: yearAgo }, { includeTo: false })
  .returningTyped(log => log.id)
  .execute();
```
