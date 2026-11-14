---
sidebar_position: 2
---

# applyPagination

## Description
`applyPagination` pages a query by `page` and `pageSize`: page 1 and 10 rows when they are missing. It adds `LIMIT` / `OFFSET`, or with `useTakeAndSkip` TypeORM's `take` / `skip`, which a query that joins a collection needs: `take` counts entities, `LIMIT` counts rows.

## Signature
```typescript
applyPagination(
  paginationFilter: PaginationFilter,
  paginationOptions?: ApplyPaginationOptions
): SelectQueryBuilder<Entity>
```

## Arguments
- paginationFilter: [PaginationFilter](../types/PaginationFilter): The pagination options to apply to the query.
- paginationOptions?: [ApplyPaginationOptions](../types/ApplyPaginationOptions): Additional options to apply to the pagination filter.

## Usage

```typescript
query.applyPagination({ page: 1, pageSize: 10 }, { useTakeAndSkip: true })
```