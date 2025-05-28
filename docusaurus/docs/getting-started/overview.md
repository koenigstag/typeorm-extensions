---
sidebar_position: 1
---

# Overview

This package provides a set of extensions for [TypeORM](https://npm.com/package/typeorm) to make it easier to work with the query builder.

## Features

- **Pagination**: apply pagination to a query.
- **Order**: apply order to a query.
- **Typed**: typesafe methods for the query builder.
  - `selectTyped` - select fields.
  - `joinTyped` - apply join conditions.
  - `whereTyped` - apply where conditions.
  - `orderByTyped` - apply order conditions.
  - `distinctOnTyped` - apply distinct on conditions (only PostgreSQL).

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


### What you'll need

- [typeorm](https://npm.com/package/typeorm)

## Use new query builder methods

Examples can be found in the [Docs/Examples](/docs/examples) section.
