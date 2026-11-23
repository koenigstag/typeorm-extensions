---
sidebar_position: 1
---

# leftJoinLateral / innerJoinLateral

## Description

`LEFT JOIN LATERAL` and `INNER JOIN LATERAL`, which TypeORM doesn't have. A LATERAL subquery runs for each row and can use the columns of the tables joined before it: the latest ticket of each user, the first three members of each room, a count per row.

```sql
SELECT "user"."id", "latest"."status"
FROM "users" "user"
LEFT JOIN LATERAL (
  SELECT "t"."ticket_status" AS "status" FROM "tickets" "t"
  WHERE "t"."owner_id" = "user"."id"
  ORDER BY "t"."ticket_id" DESC LIMIT 1
) "latest" ON TRUE
```

- `leftJoinLateral` keeps the rows without a match, with `NULL` columns.
- `innerJoinLateral` drops them.

The condition defaults to `TRUE`: the subquery usually filters by the outer row itself.

The subquery can be:

- a query builder: `ticketRepository.createQueryBuilder('t')…`;
- a factory, as for TypeORM's joins: `(qb) => qb.select(…).from(TicketEntity, 't')…`;
- raw SQL, without parentheses: `'SELECT … LIMIT 1'`. Its placeholders are the query's own parameters: pass them in `parameters`, or with `setParameter`.

The parameters of a query builder or a factory get unique names when they are added to the query (`status_x7k2q`): a subquery with `:status` doesn't clash with a `:status` of the outer query, or of another subquery. Raw SQL keeps its names. That holds for a factory or a builder of its own (`dataSource.createQueryBuilder()`), not for one made with `query.subQuery()`: it hands each parameter to `query` as it is set, before it can be renamed, and overwrites one of the same name there.

The joined columns are raw: select them with `addSelect('"latest"."status"', 'latestStatus')` and read them with `getRawMany()`, or use the alias in later joins and conditions. Inside the subquery, refer to the outer tables with quoted names, `"user"."id"`: TypeORM doesn't rewrite the outer query's property paths there.

LATERAL is available on PostgreSQL 9.3+, CockroachDB, MySQL 8.0.14+ and Oracle 12c+; Oracle before 23ai has no `TRUE`, so pass the condition there, `'1 = 1'`. SQLite, SQL Server (it has `APPLY`) and MariaDB don't support it.

## Signature

```typescript
leftJoinLateral(
  subQuery: string | SelectQueryBuilder<SubEntity> | ((qb: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>),
  alias: string,
  condition?: string, // default: 'TRUE'
  parameters?: ObjectLiteral
): this

innerJoinLateral(…the same…): this
```

## Usage

```typescript
// each user with the status of their latest ticket, NULL without tickets
const latestTicket = ticketRepository
  .createQueryBuilder('t')
  .select('t.status', 'status')
  .where('t.ownerId = "user"."id"')
  .orderBy('t.id', 'DESC')
  .limit(1);

const rows = await userRepository
  .createQueryBuilder('user')
  .select('user.id', 'id')
  .addSelect('"latest"."status"', 'status')
  .leftJoinLateral(latestTicket, 'latest')
  .getRawMany();
```

```typescript
// raw SQL with a parameter: open tickets per user
userRepository
  .createQueryBuilder('user')
  .addSelect('"open"."tickets"', 'openTickets')
  .leftJoinLateral(
    'SELECT COUNT(*) AS "tickets" FROM "tickets" "t" WHERE "t"."owner_id" = "user"."id" AND "t"."ticket_status" = :status',
    'open',
    'TRUE',
    { status: 'open' }
  );
```

```typescript
// a join on the lateral's columns: only users whose latest ticket is open
userRepository
  .createQueryBuilder('user')
  .innerJoinLateral(latestTicket, 'latest', `"latest"."status" = 'open'`);
```
