---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for `WHERE` conditions on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`): `IN`, `= ANY(...)`, PostgreSQL array and JSON operators, null-safe comparisons, period filters and `[NOT] EXISTS` subqueries.

### Methods
- [whereIsIn](./whereIsIn): add `IN` / `NOT IN` conditions by column name.
- [whereIsAny](./whereIsAny): add `= ANY(array)` conditions by column name, with the array bound as one parameter (PostgreSQL).
- [innerJoinUnnest](./innerJoinUnnest): keep the rows whose column is in an array by joining `unnest(array)`, an alternative plan to `= ANY` for large arrays (PostgreSQL).
- [whereArrayContains / ContainedBy / Overlaps](./whereArray): add `@>`, `<@`, `&&` conditions on array columns (PostgreSQL).
- [whereJsonContains / whereJsonHasKey](./whereJson): add `@>` and `?` conditions on JSON columns (PostgreSQL).
- [whereIsDistinctFrom](./whereIsDistinctFrom): add null-safe `IS [NOT] DISTINCT FROM` conditions (any database).
- [applyPeriodFilter](./applyPeriodFilter): filter by a period `{ periodFrom, periodTo }` of a date / time column (any database).
- [whereNotExists / whereExists](./whereNotExists): add `NOT EXISTS (subquery)` conditions, and `EXISTS` on update and delete queries, which TypeORM lacks (any database).

For typesafe versions that take the column from an entity property, see [whereIsInTyped](../typed/whereIsInTyped), [whereIsAnyTyped](../typed/whereIsAnyTyped), [whereArrayContainsTyped](../typed/whereArrayTyped), [whereJsonContainsTyped](../typed/whereJsonTyped), [whereIsDistinctFromTyped](../typed/whereIsDistinctFromTyped) and [applyPeriodFilterTyped](../typed/applyPeriodFilterTyped).
