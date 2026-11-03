---
sidebar_position: 1
---

# Overview

This package provides a set of extensions for [TypeORM](https://www.npmjs.com/package/typeorm) to make it easier to work with the query builder.

## Features

- **Pagination**: apply pagination to a query, or load a page together with the total count (`getManyWithTotals`).
- **Order**: apply order to a query from a filter object.
- **Where IN**: `whereIsIn` / `whereIsNotIn` conditions that handle empty arrays.
- **Typed**: typesafe methods for the query builder.
  - `selectTyped` - select fields.
  - `joinTyped` - apply join conditions.
  - `whereTyped` - apply where conditions.
  - `whereIsInTyped` - apply where IN / NOT IN conditions.
  - `orderByTyped` - apply order conditions.
  - `distinctOnTyped` - apply distinct on conditions (only PostgreSQL).
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

Helpers are exported from the package root:

```typescript
import { tableHelper } from 'typeorm-extensions';
```

### What you'll need

- [typeorm](https://www.npmjs.com/package/typeorm) `^0.3.12`

## Use new query builder methods

Examples can be found in the [Docs/Examples](/docs/examples) section, and every method is described in the [API reference](/docs/api/core/).
