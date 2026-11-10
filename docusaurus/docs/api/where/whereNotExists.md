---
sidebar_position: 8
---

# whereNotExists / whereExists

## Description

`NOT EXISTS (subquery)` conditions, and `EXISTS` conditions where TypeORM has none.

TypeORM has `whereExists` / `andWhereExists` / `orWhereExists` on `SelectQueryBuilder`, but no `NOT EXISTS`, and no `EXISTS` on `UpdateQueryBuilder` or `DeleteQueryBuilder`. This extension adds what is missing:

| Builder | `whereExists` / `andWhereExists` / `orWhereExists` | `whereNotExists` / `andWhereNotExists` / `orWhereNotExists` |
|---|---|---|
| `SelectQueryBuilder` | TypeORM's own | added |
| `UpdateQueryBuilder`, `DeleteQueryBuilder` | added | added |

A method is added only where the builder doesn't have it already, so TypeORM's own methods, in this version or a later one, stay as they are. Inside `Brackets` the callback gets a builder of the query's class, with the same methods.

The condition is TypeORM's: the subquery selects `1`, without its ORDER BY, GROUP BY, LIMIT and OFFSET, and `NOT EXISTS` is its negation. One exception: a subquery with a HAVING keeps its GROUP BY. TypeORM drops it there too, so the HAVING aggregates the whole subquery: "two tickets of one status" would match two tickets of different statuses. TypeORM's own `whereExists` on a `SelectQueryBuilder` still does that.

### Parameters

A query has one parameter namespace. TypeORM's `whereExists` adds the subquery's parameters under their own names, so two subqueries that both use `:status` read whichever value was set last. The methods of this extension rename the subquery's parameters to unique names (`status_x7k2q`), so each subquery keeps its own values.

## Signature

```typescript
whereNotExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this
andWhereNotExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this
orWhereNotExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this

// UpdateQueryBuilder, DeleteQueryBuilder
whereExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this
andWhereExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this
orWhereExists<SubEntity>(subQuery: SelectQueryBuilder<SubEntity>): this
```

## Arguments

- subQuery: SelectQueryBuilder: The subquery. It can refer to the outer query's alias: `.where('ticket.ownerId = "user"."id"')`.

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
