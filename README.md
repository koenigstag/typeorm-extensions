# TypeORM Extensions

[![Build Status](https://travis-ci.org/your-username/typeorm-extensions.svg?branch=main)](https://travis-ci.org/your-username/typeorm-extensions)
[![npm version](https://badge.fury.io/js/typeorm-extensions.svg)](https://badge.fury.io/js/typeorm-extensions)

## Description

TypeORM Extensions is a library that provides additional functionality and extensions for the TypeORM QueryBuilder. It aims to simplify common tasks and enhance the capabilities of TypeORM.

## Features

- Simplicity: applying pagination and ordering to queries is as simple as calling a method.
- Type Safety: the library is written in TypeScript and provides type-safe QueryBuilder methods based on Entity  metadata.
- Flexibility: the library is designed to be flexible and can be used with any TypeORM entity.

## Installation

To install `typeorm-extensions`:

Npm:
```bash
npm install typeorm-extensions
```

## Usage

```typescript
import 'typeorm-extensions'; // Import the library root to extend the QueryBuilder with all extensions

// Or init specific extension: import from 'typeorm-extensions/dist/extensions/pagination.extension';

const query = myDataSource
  .createQueryBuilder()
  .from(User, 'user')
  .selectTyped(user => ([
    id: user.id,
    name: user.name,
    email: user.email,
  ]))
  .whereTyped(user => user.name, 'ILIKE :search', { search: 'John' })
  .orderTyped(user => user.createdAt, 'ASC')
  .applyPagination({ page: 1, pageSize: 10 });
```

## Documentation

For more information, please refer to the [documentation](https://koenigstag.github.io/typeorm-extensions).
