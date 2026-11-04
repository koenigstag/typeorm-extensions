---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for `WHERE` conditions on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`: `IN`, `= ANY(...)`, PostgreSQL array and JSON operators, and null-safe comparisons.

### Methods
- [whereIsIn](./whereIsIn): add `IN` / `NOT IN` conditions by column name.
- [whereIsAny](./whereIsAny): add `= ANY(array)` conditions by column name, with the array bound as one parameter (PostgreSQL).
- [whereArrayContains / ContainedBy / Overlaps](./whereArray): add `@>`, `<@`, `&&` conditions on array columns (PostgreSQL).
- [whereJsonContains / whereJsonHasKey](./whereJson): add `@>` and `?` conditions on JSON columns (PostgreSQL).
- [whereIsDistinctFrom](./whereIsDistinctFrom): add null-safe `IS [NOT] DISTINCT FROM` conditions (any database).

For typesafe versions that take the column from an entity property, see [whereIsInTyped](../typed/whereIsInTyped), [whereIsAnyTyped](../typed/whereIsAnyTyped), [whereArrayContainsTyped](../typed/whereArrayTyped), [whereJsonContainsTyped](../typed/whereJsonTyped) and [whereIsDistinctFromTyped](../typed/whereIsDistinctFromTyped).
