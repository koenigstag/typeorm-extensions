---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for typed features. Instead of column strings, typed methods take a [KeyProxyCallback](./types/KeyProxyCallback.md) like `user => user.name`, so column names are checked by TypeScript.

Where methods also go into JSON columns (`exec => exec.details.meta.endTs`, see [Paths into JSON columns](./whereTyped#paths-into-json-columns)), and with the opt-in [`strictParams`](./whereTyped#checking-parameters-strictparams) their parameters are checked against the column type.

### Methods:
- [selectTyped](./selectTyped): add typesafe select to a query.
- [joinTyped](./joinTyped): add typesafe join to a query.
- [whereTyped](./whereTyped): add typesafe condition to a query.
- [whereIsInTyped](./whereIsInTyped): add typesafe IN / NOT IN condition to a query.
- [whereIsAnyTyped](./whereIsAnyTyped): add typesafe `= ANY(array)` condition to a query (only PostgreSQL).
- [whereArrayContainsTyped / ContainedByTyped / OverlapsTyped](./whereArrayTyped): add typesafe array column conditions to a query (only PostgreSQL).
- [whereJsonContainsTyped / whereJsonHasKeyTyped](./whereJsonTyped): add typesafe JSON column conditions to a query (only PostgreSQL).
- [whereIsDistinctFromTyped](./whereIsDistinctFromTyped): add typesafe null-safe comparison to a query.
- [applyPeriodFilterTyped](./applyPeriodFilterTyped): filter by a period of a typesafe date / time property.
- [whereILikeTyped](./whereILikeTyped): add typesafe case-insensitive `LIKE` with escaped wildcards (`ILIKE` on PostgreSQL).
- [whereSearchTyped](./whereSearchTyped): search several columns for one value, as one `OR` group.
- [whereLowerEqualsTyped / whereIsInLowerTyped](./whereLowerTyped): add typesafe case-insensitive equality / `IN` (`LOWER(…)`).
- [whereSimilarTyped / addSimilarityScoreTyped](./whereSimilarTyped): add typesafe trigram similarity conditions and scores (PostgreSQL + `pg_trgm`).
- [orderByTyped](./orderByTyped): add typesafe order to a query.
- [distinctOnTyped](./distinctOnTyped): add typesafe distinct on to a query (only PostgreSQL).
- [groupByTyped](./groupByTyped): add typesafe GROUP BY to a query.
- [orderByArrayPositionTyped](./orderByArrayPositionTyped): order by the position of a property's value in an array (only PostgreSQL).
- [returningTyped](./returningTyped): return typesafe columns from INSERT / UPDATE / DELETE (PostgreSQL, MariaDB, SQL Server).

### Types:
- [KeyProxyCallback](./types/KeyProxyCallback): the callback that selects entity properties, and how it maps to SQL keys.
- [Json&lt;T&gt;](./whereTyped#paths-into-json-columns): marks a JSON column, so typed callbacks go into it at any depth.
