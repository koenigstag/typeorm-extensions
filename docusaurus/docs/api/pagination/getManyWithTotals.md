---
sidebar_position: 3
---

# getManyWithTotals

## Description

`getManyWithTotals` loads one page of entities together with the total number of matching rows, the page `limit` and `offset`, whether more rows follow (`hasMore`) and the SQL order the page was read in (`orderBy`).

It runs two queries one after another:
1. `getCount()` on the query as it is, before pagination is applied, to get the total;
2. `getMany()` with [applyPaginationFilter](./applyPaginationFilter.md) applied, to get the page.

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
// hasMore - true while rows follow the page, null without a total or an offset
// orderBy - [{ selector: 'user.lastName', order: 'ASC' }] — SQL selectors, for logs
```

```typescript
// Only the page, without the count query: total and hasMore are null
await query.getManyWithTotals({ page: 1, pageSize: 10 }, { disableTotalsCalculation: true });
```

```typescript
// All matching rows: pagination is not applied, limit, offset and hasMore are null
await query.getManyWithTotals({}, { loadAll: true });
```
