---
sidebar_position: 1
---

# Overview

This package provides a set of extensions for [TypeORM](https://www.npmjs.com/package/typeorm) to make it easier to work with the query builder.

## Features

- **Pagination**: apply pagination to a query, load a page together with the total count (`getManyWithTotals`), or page with a cursor (`getManyWithCursor`).
- **Order**: apply order to a query from a filter object, or by the position in an array of ids (`orderByArrayPosition`, only PostgreSQL).
- **Where**: `whereIsIn` / `whereIsNotIn` conditions that handle empty arrays; `whereIsAny` for `= ANY(array)` with the array bound as one parameter, array and JSON operators (only PostgreSQL); null-safe `whereIsDistinctFrom`; period filters (`applyPeriodFilter`).
- **Typed**: typesafe methods for the query builder.
  - `selectTyped` - select fields.
  - `joinTyped` - apply join conditions.
  - `whereTyped` - apply where conditions.
  - `whereIsInTyped` - apply where IN / NOT IN conditions.
  - `whereIsAnyTyped` - apply where `= ANY(array)` conditions (only PostgreSQL).
  - `orderByTyped` - apply order conditions.
  - `distinctOnTyped` - apply distinct on conditions (only PostgreSQL).
  - `returningTyped` - return columns from INSERT / UPDATE / DELETE.
- **tableHelper**: typesafe helper for building SQL fragments: column references, conditions, joins, counts and JSONB paths.

## Getting Started

Get started by **installing the package**:

```bash
npm install typeorm-extensions
```

Then **import the package root** to init all extensions:

```typescript
import 'typeorm-extensions';
```

Or import specific extension to init only it, if needed:

```typescript
import 'typeorm-extensions/dist/extensions/name.extension';
```

Helpers are exported from the package root, and from `typeorm-extensions/helpers`, which installs no extension. Use the latter if you import extensions one by one:

```typescript
import { tableHelper } from 'typeorm-extensions/helpers'; // no side effects
import { tableHelper } from 'typeorm-extensions'; // also installs all extensions
```

### What you'll need

- [typeorm](https://www.npmjs.com/package/typeorm) `^0.3.12`

## Use new query builder methods

Examples can be found in the [Docs/Examples](/docs/examples) section, and every method is described in the [API reference](/docs/api/core/).
