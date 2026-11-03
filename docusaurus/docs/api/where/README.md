---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for `WHERE ... IN` and `WHERE ... = ANY(...)` conditions on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`.

### Methods
- [whereIsIn](./whereIsIn): add `IN` / `NOT IN` conditions by column name.
- [whereIsAny](./whereIsAny): add `= ANY(array)` conditions by column name, with the array bound as one parameter (PostgreSQL).

For typesafe versions that take the column from an entity property, see [whereIsInTyped](../typed/whereIsInTyped) and [whereIsAnyTyped](../typed/whereIsAnyTyped).
