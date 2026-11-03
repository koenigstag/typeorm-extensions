# Changelog

## [1.4.0] - Unreleased

### Breaking Changes

- **Renamed `useDoubleQuotes` to `useQuotes`** in the options types `ApplyOrderOptions`, `TypedWhereOptions` and `TypedWhereIsInOptions`. The positional `useDoubleQuotes` parameter of `selectTyped` / `addSelectTyped` is renamed to `useQuotes` as well (positional calls keep working).
- **`addOrderByTyped` takes an options object as its 4th argument**: `useDoubleQuotes?: boolean` became `options?: TypedOrderByOptions`. Migrate `addOrderByTyped(cb, 'ASC', undefined, true)` to `addOrderByTyped(cb, 'ASC', undefined, { useQuotes: true })`. In plain JS a boolean passed there is now ignored, so `true` silently stops quoting the key (`user.name` instead of `"user"."name"`).

### New Features

- **`tableHelper` utility**, exported from the package root (`import { tableHelper } from 'typeorm-extensions'`) — type-safe SQL helper for building column references, WHERE expressions, JOIN clauses, and JSONB accessors.
  - `column()` — quoted SQL column identifier
  - `where()` — column with expression
  - `join()` / `joinOn()` — join path helpers
  - `isNull()` / `isNotNull()` — null check expressions
  - `count()` / `cast()` — aggregate and cast helpers (`count()` without a column counts `alias.*`, or `*` without an alias)
  - `jsonColumn()` — full JSONB column access expression with typed field names
  - `jsonPath()` — JSONB operator fragment for use in `whereTyped` conditions strings
- **JSONB access via `tableHelper`** with nested paths as rest params. Field names are inferred from the column's TypeScript type (autocomplete up to 4 levels deep) and escaped as SQL string literals:
  ```ts
  const t = tableHelper<User>('user');
  t.jsonColumn('metadata', '->>', 'role')               // "user"."metadata" ->> 'role'
  t.jsonColumn('metadata', '->>', 'settings', 'theme')   // "user"."metadata" -> 'settings' ->> 'theme'
  t.jsonPath('metadata', '->>', 'role')                  // ->> 'role'
  ```
- **`TypedOrderByOptions`** — options for `orderByTyped` and `addOrderByTyped` with `useQuotes` support (`orderByTyped` had no quoting option before).

### Bug Fixes

- Typed proxy callbacks no longer fail with type errors on array relations (e.g. `user => user.images.url` where `images` is `ImageEntity[]`): arrays are unwrapped in the proxy type of all typed methods.
- `whereIsNotInTyped` / `andWhereIsNotInTyped` / `orWhereIsNotInTyped` on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder` now default `Type` to the builder's entity, like the `IsIn` variants. Previously the callback accepted any property. (#4)
- `whereTyped` / `andWhereTyped` / `orWhereTyped`: when `options.addValue` is not set, it now defaults to `false` if `condition` already references a key of `params` (`'= :id'` with `{ id }`, `'IN (:...ids)'` with `{ ids }`). Previously a second placeholder was appended and the SQL was invalid. `::type` casts and colons inside literals are not treated as placeholders. (#6)

### Improvements

- Added `OrderEntity extends ObjectLiteral` constraint to `applyOrder` / `applyOrderFilter` generics.
- Added JSDoc documentation for all `tableHelper` methods.
- Added test coverage for `tableHelper`, typed key resolution (`getKey`), JSONB `whereTyped` conditions and `addValue` placeholder detection.
- Added `UserMetadata` typed JSONB column to test entity.
- Added `CLAUDE.md` project overview for AI-assisted development.

### Internal

- Removed the `Identifier` class (`src/utils/identifier.utils.ts`, never exported from the package); the order extension now builds identifiers with `tableHelper`.

## [1.3.5] - 2025-12-12

### Bug Fixes

- Refactored `where.utils.ts` to only add value when param is present (not `undefined`).

### Maintenance

- npm audit fix.

## [1.3.4] - 2025-12-12

### Maintenance

- Version bump. 1.3.3 was tagged but never published to npm, so 1.3.4 is the first npm release with the 1.3.3 changes below.

## [1.3.3] - 2025-12-12

> Not published to npm — these changes first shipped in 1.3.4.

### New Features

- **`isReversed` option for order** — added `isReversed` boolean to `OrderParam` type for toggling order direction.
- **`tableAlias` option** — added `tableAlias` to `OrderOptions` for custom alias support in order expressions.

### Improvements

- Narrowed `OrderParam` field type definition.
- Refactored alias assignment logic in `order.extension.ts`.
- Refactored direction handling for null value case.
- Improved test coverage.
- Added `whereTyped` options documentation.
- Upgraded Docusaurus and refactored docs deployment.
- Added `setupTest` utility for test infrastructure.

## [1.3.2] - 2025-05-25

### Improvements

- Refactored declarations merging and types.
- Added CI/CD pipelines: npm publish, lint, and test actions.
- Fixed declarations.
