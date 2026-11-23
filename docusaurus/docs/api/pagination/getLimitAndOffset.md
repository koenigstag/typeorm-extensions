---
sidebar_position: 7
---

# getLimitAndOffset

## Description

`getLimitAndOffset` is the arithmetic `applyPagination` and `getManyWithTotals` use, for code that pages something other than a query builder (a raw query, an in-memory list) or reports `limit` / `offset` next to its rows. `page` is 1-based. A missing page, or text that is not a number of at least 1, is page 1; a missing or invalid page size is the default page size (10, or `defaultPageSize`).

`normalizePageSize` is the page-size half alone.

## Signature

```typescript
import { getLimitAndOffset, normalizePageSize } from 'typeorm-extensions/helpers';

getLimitAndOffset(
  paginationFilter: PaginationFilter | null | undefined,
  options?: { defaultPageSize?: number }
): { limit: number; offset: number; page: number; pageSize: number }

normalizePageSize(pageSize: unknown, options?: { defaultPageSize?: number }): number
```

## Usage

```typescript
getLimitAndOffset({ page: 3, pageSize: 25 });          // { limit: 25, offset: 50, page: 3, pageSize: 25 }
getLimitAndOffset({ page: 2 }, { defaultPageSize: 20 }); // { limit: 20, offset: 20, page: 2, pageSize: 20 }
getLimitAndOffset(undefined);                            // { limit: 10, offset: 0, page: 1, pageSize: 10 }
```
