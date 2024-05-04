# TypeORM Extensions

[![npm version](https://badge.fury.io/js/typeorm-extensions.svg)](https://badge.fury.io/js/typeorm-extensions)
[![npm downloads](https://img.shields.io/npm/dm/typeorm-extensions)](https://www.npmjs.com/package/typeorm-extensions)
[![Issues](https://img.shields.io/github/issues-raw/koenigstag/typeorm-extensions.svg?maxAge=25000)](https://github.com/koenigstag/typeorm-extensions/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/koenigstag/typeorm-extensions/pulls)

## Description

TypeORM Extensions is a library that provides additional functionality and extensions for the TypeORM QueryBuilder. It aims to simplify common tasks and enhance the capabilities of TypeORM.

## Features

- Simplicity: applying pagination and ordering to queries is as simple as calling a method.
- Type Safety: the library is written in TypeScript and provides type-safe QueryBuilder methods based on Entity  metadata.
- Flexibility: the library is designed to be flexible and can be used with any TypeORM entity.

## Installation

To install `typeorm-extensions`:

Install using npm, yarn or pnpm:
```bash
npm install typeorm-extensions
```

## Usage

```typescript
import 'typeorm-extensions'; // Import the library root to extend the QueryBuilder with all extensions

// Or init specific extension: import 'typeorm-extensions/dist/extensions/pagination.extension';

const query = myDataSource
  .createQueryBuilder()
  .from(UserEntity, 'users')
  // Join relation defined in entity model
  .leftJoinTyped(user => user.profile, 'profile')
  // Select type-safe properties
  .selectTyped(user => ([
    id: user.id,
    name: user.name,
    email: user.email,
  ]))
  .whereTyped(user => user.name, 'ILIKE :search', { search: 'John' })
  // Order by type-safe own and relation properties
  .orderByTyped(user => user.profile.avatarUrl, 'ASC', 'NULLS LAST')
  // Use pagination as simple as that
  .applyPaginationFilter({ page: 1, pageSize: 10 }, { useTakeAndSkip: true });
```

## Documentation

For more information, please refer to the [documentation](https://koenigstag.github.io/typeorm-extensions).

## ToDo list

- [ ] Add tests for pagination and order extensions
- [ ] Virtual column decorator and its query-builder methods (`addSelectVirtual`, `orderByVirtual`, `getManyWithVirtual`, `getOneWithVirtual`).
- [ ] Add `withVirtualColumns` option to `findManyWithTotals` method to use `getManyWithVirtual` instead of `getMany`
- [ ] Add `isVirtual` option to `OrderParam` to indicate usage of `orderByVirtual` method
- [ ] Refactor `applyOrder` to
- [ ] Add option to `findManyWithTotals` to disable pagination
