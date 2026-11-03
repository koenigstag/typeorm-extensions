---
sidebar_position: 1
---

# Overview

## Description

This category provides a set of extensions for typed features. Instead of column strings, typed methods take a [KeyProxyCallback](./types/KeyProxyCallback.md) like `user => user.name`, so column names are checked by TypeScript.

### Methods:
- [selectTyped](./selectTyped): add typesafe select to a query.
- [joinTyped](./joinTyped): add typesafe join to a query.
- [whereTyped](./whereTyped): add typesafe condition to a query.
- [whereIsInTyped](./whereIsInTyped): add typesafe IN / NOT IN condition to a query.
- [whereIsAnyTyped](./whereIsAnyTyped): add typesafe `= ANY(array)` condition to a query (only PostgreSQL).
- [orderByTyped](./orderByTyped): add typesafe order to a query.
- [distinctOnTyped](./distinctOnTyped): add typesafe distinct on to a query (only PostgreSQL).

### Types:
- [KeyProxyCallback](./types/KeyProxyCallback): the callback that selects entity properties, and how it maps to SQL keys.
