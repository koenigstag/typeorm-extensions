---
sidebar_position: 5
---

# getRawManyWithTotals

## Description

[getManyWithTotals](./getManyWithTotals.md) for raw rows: one page from `getRawMany()`, with the total number of rows, `page`, `pageSize`, `limit`, `offset`, `hasMore` and `orderBy`. Use it for queries whose rows are not entities: aggregates, `GROUP BY`, selected expressions.

The page is paged with `LIMIT` / `OFFSET`: `take` / `skip` page entities, not raw rows, so there is no `useTakeAndSkip` option.

`total` is the number of rows the query returns without pagination. The query is counted as a subquery, without its `ORDER BY`, `LIMIT` and `OFFSET`:

```sql
SELECT COUNT(*) AS "count" FROM (<the query>) "counted"
```

so `GROUP BY`, `HAVING` and `DISTINCT` count the way they page: a query grouped by owner counts owners, not the rows they group. `getCount()` would not do that, it drops `GROUP BY` and counts entities.

The count and the page run at the same time, and one after another on a builder bound to a query runner, as with `getManyWithTotals`; the count runs on that query runner too, inside its transaction. `disableTotalsCalculation` skips the count and reads one row past the page for `hasMore`, `loadAll` reads every row.

### countExpression

Counting the whole query as a subquery computes every row of it, aggregates included. When an expression of the query counts its rows by itself, pass it as `countExpression`: it replaces the select list, and `GROUP BY`, `HAVING` and `DISTINCT` (`DISTINCT ON` too) are dropped.

```typescript
// grouped by user: counting distinct users counts the rows
query.getRawManyWithTotals(filter, { countExpression: 'COUNT(DISTINCT "order"."user_id")' })
```

It can't count a query with `HAVING`: the groups `HAVING` drops are counted too. `COUNT(DISTINCT …)` also skips `NULL`, which a `GROUP BY` keeps as a group of its own. A `DISTINCT` query is counted right only by a `COUNT(DISTINCT …)` of its own columns.

On MySQL the subquery has to name its columns uniquely, as a derived table: two selections both named `id` fail with `Duplicate column name`. TypeORM names a selection without an alias `alias_column`, but `select('*')` over a self-join or two tables with a column of the same name gives duplicates too. Alias the columns, or count with `countExpression`.

## Signature

```typescript
getRawManyWithTotals<Row = ObjectLiteral>(
  paginationFilter: PaginationFilter,
  options?: GetRawManyWithTotalsOptions
): Promise<ListWithTotals<Row>>

type GetRawManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
  countExpression?: string;
};
```

## Arguments

- paginationFilter: [PaginationFilter](./types/PaginationFilter.md): Page number (1-based) and page size.
- options?: Skip the count query, load all rows, or count with `countExpression`.

## Usage

```typescript
// tickets per owner, two owners per page; total is the number of owners
const page = await ticketRepository
  .createQueryBuilder('ticket')
  .select('ticket.ownerId', 'ownerId')
  .addSelect('COUNT(*)', 'tickets')
  .groupBy('ticket.ownerId')
  .orderBy('ticket.ownerId')
  .getRawManyWithTotals<{ ownerId: number; tickets: number | string }>({ page: 1, pageSize: 2 });

// total: 3 owners, list: the first two of them, hasMore: true
```
