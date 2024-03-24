---
sidebar_position: 3
---

# interface PaginationFilter

## Description

`PaginationFilter` is an pagination interface which you can use in your filters.

## Definition

```typescript
interface PaginationFilter {
  page?: number;
  pageSize?: number;
}
```

## Example

```typescript
class UsersFilter implements PaginationFilter {
  page: number = 1;
  pageSize: number = 10;
}
```