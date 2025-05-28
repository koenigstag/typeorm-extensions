---
sidebar_position: 2
---

# applyPaginationFilter

## Description
`applyPaginationFilter` is a method that applies pagination to a query.

## Signature
```typescript
applyPaginationFilter(
  paginationFilter: PaginationFilter,
  paginationOptions?: ApplyPaginationOptions
): SelectQueryBuilder<Entity>
```

## Arguments
- paginationFilter: [PaginationFilter](../types/PaginationFilter): The pagination options to apply to the query.
- paginationOptions?: [ApplyPaginationOptions](../types/ApplyPaginationOptions): Additional options to apply to the pagination filter.

## Usage

```typescript
query.applyPaginationFilter({ page: 1, pageSize: 10 }, { useTakeAndSkip: true })
```