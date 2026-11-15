---
sidebar_position: 8
---

# whereNotExists / whereExists

## Description

`NOT EXISTS (subquery)` conditions, and `EXISTS` conditions where TypeORM has none.

TypeORM has `whereExists` / `andWhereExists` / `orWhereExists` on `SelectQueryBuilder`, but no `NOT EXISTS`, and no `EXISTS` on `UpdateQueryBuilder`, `DeleteQueryBuilder` or the `SoftDeleteQueryBuilder` of `softDelete()` / `restore()`. This extension adds what is missing:

| Builder | `whereExists` / `andWhereExists` / `orWhereExists` | `whereNotExists` / `andWhereNotExists` / `orWhereNotExists` |
|---|---|---|
| `SelectQueryBuilder` | TypeORM's own | added |
| `UpdateQueryBuilder`, `DeleteQueryBuilder`, `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`) | added | added |

A method is added only where the builder doesn't have it already, so TypeORM's own methods, in this version or a later one, stay as they are; on `SelectQueryBuilder` they also take a [factory](#a-factory), which goes through this extension. Inside `Brackets` the callback gets a builder of the query's class, with the same methods.

The condition is TypeORM's: the subquery selects `1`, without its ORDER BY, GROUP BY, LIMIT and OFFSET, and `NOT EXISTS` is its negation. One exception: a subquery with a HAVING keeps its GROUP BY. TypeORM drops it there too, so the HAVING aggregates the whole subquery: "two tickets of one status" would match two tickets of different statuses. TypeORM's own `whereExists` on a `SelectQueryBuilder` still does that.

### Parameters

A query has one parameter namespace. TypeORM's `whereExists` adds the subquery's parameters under their own names, so two subqueries that both use `:status` read whichever value was set last. The methods of this extension rename the subquery's parameters to unique names (`status_x7k2q`), so each subquery keeps its own values.

### A factory

Each method takes the subquery as a query builder or as a factory, `(sub) => sub.select('1').from(TicketEntity, 'ticket').where(…)`. The factory gets a new query builder on the query's connection and query runner, so the subquery runs in the same transaction, and returns the subquery. Its parameters get unique names like those of a query builder.

TypeORM's `whereExists` / `andWhereExists` / `orWhereExists` on `SelectQueryBuilder` take a query builder only. The extension wraps them: a query builder still goes to TypeORM's method, a factory to this extension's, with unique parameter names and the GROUP BY kept for a HAVING.

## Signature

```typescript
type ExistsSubQuery<SubEntity> =
  | SelectQueryBuilder<SubEntity>
  | ((subQuery: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>);

whereNotExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this
andWhereNotExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this
orWhereNotExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this

// UpdateQueryBuilder, DeleteQueryBuilder; on SelectQueryBuilder, TypeORM's with a factory added
whereExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this
andWhereExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this
orWhereExists<SubEntity>(subQuery: ExistsSubQuery<SubEntity>): this
```

## Arguments

- subQuery: SelectQueryBuilder or factory: The subquery, or a function that builds it on the query builder it gets. It can refer to the outer query's alias: `.where('ticket.ownerId = "user"."id"')`.

## Usage

```typescript
// users without an open ticket
// WHERE NOT EXISTS (SELECT 1 FROM "tickets" "ticket" WHERE "ticket"."owner_id" = "user"."id" AND "ticket"."status" = :status_x7k2q)
const openTickets = dataSource
  .getRepository(TicketEntity)
  .createQueryBuilder('ticket')
  .where('ticket.ownerId = "user"."id"')
  .andWhere('ticket.status = :status', { status: 'open' });

userRepository
  .createQueryBuilder('user')
  .andWhereNotExists(openTickets);
```

```typescript
// tickets whose owner is gone
dataSource
  .createQueryBuilder()
  .update(TicketEntity)
  .set({ status: 'orphan' })
  .whereNotExists(
    userRepository.createQueryBuilder('user').where('"user"."id" = "tickets"."owner_id"')
  )
  .execute();
```

```typescript
// the same with a factory, on TypeORM's andWhereExists: users with an open ticket
userRepository
  .createQueryBuilder('user')
  .andWhereExists((sub) =>
    sub
      .select('1')
      .from(TicketEntity, 'ticket')
      .where('ticket.ownerId = "user"."id"')
      .andWhere('ticket.status = :status', { status: 'open' })
  );
```
