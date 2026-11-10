---
sidebar_position: 1
---

# fromUnion / addCommonTableExpressionUnion

## Description

TypeORM has no UNION. The usual way around it pastes the SQL of two query builders and merges their parameters:

```typescript
query
  .from(`(${open.getQuery()} UNION ${closed.getQuery()})`, 'u')
  .setParameters({ ...open.getParameters(), ...closed.getParameters() });
```

A query has one parameter namespace. If both parts were built by the same function, both have a `:status`, and the merged object keeps only the last value: both parts read `'closed'`, and nothing fails. `fromUnion` and `addCommonTableExpressionUnion` give the parameters of each part unique names first, so each part keeps its own. Build the parts as builders of their own, `dataSource.createQueryBuilder()` or a repository's: a part made with `query.subQuery()` hands each parameter to `query` as it is set, before it can be renamed, and overwrites one of the same name there.

```typescript
const ticketsWithStatus = (status: string) =>
  ticketRepository
    .createQueryBuilder('ticket')
    .select('ticket.id', 'id')
    .where('ticket.status = :status', { status });

const rows = await dataSource
  .createQueryBuilder()
  .fromUnion([ticketsWithStatus('open'), ticketsWithStatus('closed')], 'u')
  .select('u.id', 'id')
  .getRawMany();
```

```sql
SELECT "u"."id" AS "id" FROM (
  (SELECT "ticket"."ticket_id" AS "id" FROM "tickets" "ticket" WHERE "ticket"."ticket_status" = :status_x1Fq2)
  UNION
  (SELECT "ticket"."ticket_id" AS "id" FROM "tickets" "ticket" WHERE "ticket"."ticket_status" = :status_Kd8wA)
) "u"
```

## Signature

```typescript
fromUnion(queries: UnionQuery[], alias: string, options?: { all?: boolean }): this

addCommonTableExpressionUnion(
  queries: UnionQuery[],
  alias: string,
  options?: { all?: boolean; materialized?: boolean; columnNames?: string[] }
): this

type UnionQuery = string | { getQuery(): string; getParameters(): ObjectLiteral };
```

## Arguments

- queries: the parts of the UNION, at least one. A query builder (or anything with `getQuery()` / `getParameters()`) gets its parameters renamed and set on this builder. A raw SQL string is used as is: its placeholders read the parameters of this builder.
- alias: the alias of the FROM, or the name of the common table expression.
- options.all: `UNION ALL`, which keeps duplicate rows. Defaults to `false`: `UNION` removes them.
- `addCommonTableExpressionUnion` also takes the options of TypeORM's `addCommonTableExpression`: `materialized`, `columnNames`.

The parts must select the same number of columns, in the same order: the database checks that.

## Usage

```typescript
// a UNION as a common table expression, joined to the entity
userRepository
  .createQueryBuilder('user')
  .addCommonTableExpressionUnion([memberIds, attendeeIds], 'candidate_ids')
  .innerJoin('candidate_ids', 'candidate_ids', '"candidate_ids"."userId" = "user"."id"')
  .getMany();
```

```typescript
// raw SQL parts read this builder's parameters
query
  .fromUnion([closedTickets, 'SELECT "owner_id" AS "ownerId" FROM "tickets" WHERE "ticket_status" = :status'], 'u')
  .setParameter('status', 'open');
```

## Databases

Each part is in parentheses, `(A) UNION (B)`, so a part may have its own ORDER BY and LIMIT. SQLite takes no parentheses there, nor an ORDER BY inside a part, which a query of an entity with a default `orderBy` has: on SQLite a part with an ORDER BY, a LIMIT or an OFFSET is `SELECT * FROM (A)` instead, and the others stay bare. The recursive part of a CTE (`recursive: true`) can't be a subquery on SQLite, so it can't have an ORDER BY or a LIMIT there.
