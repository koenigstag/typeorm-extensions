---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for pagination features.

### Methods
- [applyPagination](./applyPagination): apply pagination to a query.
- [getManyWithTotals](./getManyWithTotals): load a page of entities together with the total count.
- [getManyWithCursor](./getManyWithCursor): load a page with keyset (cursor) pagination, for feeds and large tables.
- [getRawManyWithTotals](./getRawManyWithTotals): load a page of raw rows (aggregates, `GROUP BY`) together with the total count.
- [getRawManyWithCursor](./getRawManyWithCursor): keyset pagination of raw rows, ordered by SQL expressions such as a computed rank.

### Types
- [PaginationFilter](./types/PaginationFilter): interface that represents a pagination filter.
- [ApplyPaginationOptions](./types/ApplyPaginationOptions): type that controls pagination configuration.
- [GetManyWithTotalsOptions](./types/GetManyWithTotalsOptions): type that controls `getManyWithTotals`.
- [ListWithTotals](./types/ListWithTotals): result of `getManyWithTotals` and `getRawManyWithTotals`.
