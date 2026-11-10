---
sidebar_position: 3
---

# getManyWithTotals

## Description

`getManyWithTotals` loads one page of entities together with the total number of matching rows, the page `limit` and `offset`, whether more rows follow (`hasMore`) and the SQL order the page was read in (`orderBy`).

It runs two queries:
1. `getCount()` on the query as it is, before pagination is applied, to get the total;
2. `getMany()` with [applyPaginationFilter](./applyPaginationFilter.md) applied, to get the page.

They run at the same time, so the call takes as long as the slower one. The count goes on a clone of the builder, taken before the page query applies its limit. On a builder bound to a query runner — from a transactional manager, or inside `dataSource.transaction` — they run one after another instead: there is a single connection, on which the driver would serialise them anyway, and on `pg` that queue is deprecated.

When one of them fails, the call waits for the other before it rejects with the first error (the count's, if both fail), so it never returns with a query still running on the pool.

With `disableTotalsCalculation` only the second query runs, and it asks for `pageSize + 1` rows: the extra row is dropped from `list` and only tells `hasMore`, the way [getManyWithCursor](./getManyWithCursor.md) does it.

## Signature

```typescript
getManyWithTotals(
  paginationFilter: PaginationFilter,
  options?: GetManyWithTotalsOptions
): Promise<ListWithTotals<Entity>>
```

## Arguments

- paginationFilter: [PaginationFilter](./types/PaginationFilter.md): Page number (1-based) and page size. Invalid or missing values fall back to page `1` and page size `10`.
- options?: [GetManyWithTotalsOptions](./types/GetManyWithTotalsOptions.md): Skip the count query, or load all rows without pagination.

## What the count counts

The count runs on the query **as it is**, so every condition already on the builder applies to it too. Only the pagination is left out: the clone is taken before `limit` / `offset` are applied, and TypeORM additionally drops `limit`, `offset`, `take`, `skip`, `groupBy` and the order from the count query.

That makes one mistake easy to miss: a condition that belongs to a single page — the boundary of a cursor, `user.id > :lastId` — narrows the count as well, and `total` then counts the rows of that page's tail instead of the whole list (a first page reporting 60 and a second 35). Apply such a condition to a separate builder, or page with [getManyWithCursor](./getManyWithCursor.md), which is built for it.

## Cost

- The count is often as expensive as the page itself — on a text search with `COUNT(DISTINCT …)` the two take about the same time — and the call can only be as fast as the slower of the two.
- Running them together takes two connections from the pool instead of one, for the length of the call.
- If the count fails, for instance on a statement timeout, the whole call fails, even though the page was already read; `Promise.all` reports the first error and the other result is dropped. Nothing is logged by the extension itself.
- `disableTotalsCalculation` costs nothing in information except `total` itself: `hasMore` is still known, from one row past the page. If the page only needs a "load more" control rather than a page count, this is the path to take — not a last resort for queries that turned out slow.

:::tip Do you need the total, or only `hasMore`?

A list that renders "load more" needs `hasMore`, not `total`, and then the count query is pure cost — often as much again as the page. Pass `disableTotalsCalculation` and read `hasMore`.

Reach for `total` when the interface shows a count or numbered pages. Note that a client computing `hasMore` from `total` (`list.length < total`) breaks on `total: null`, silently: it reads as "no more rows". Read `hasMore` instead, which is a boolean whenever a page was requested.

:::

## Returns

[ListWithTotals&lt;Entity&gt;](./types/ListWithTotals.md): `{ list, total, limit, offset, hasMore, orderBy }`.

## Usage

```typescript
const { list, total, limit, offset, hasMore, orderBy } = await usersRepository
  .createQueryBuilder('user')
  .whereTyped(user => user.lastName, 'LIKE', '%Doe%')
  .orderBy('user.lastName', 'ASC')
  .getManyWithTotals({ page: 2, pageSize: 20 });

// list    - users 21..40
// total   - number of all users matching the condition
// limit   - 20
// offset  - 20
// hasMore - true while rows follow the page, null only with loadAll
// orderBy - [{ selector: 'user.lastName', order: 'ASC' }] — SQL selectors, for logs
```

```typescript
// Only the page, without the count query: total is null, hasMore still known
// (11 rows are read, the 11th is dropped and only answers hasMore)
await query.getManyWithTotals({ page: 1, pageSize: 10 }, { disableTotalsCalculation: true });
```

```typescript
// All matching rows: pagination is not applied, limit, offset and hasMore are null
await query.getManyWithTotals({}, { loadAll: true });
```
