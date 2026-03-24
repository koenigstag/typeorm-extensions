# Changelog

## [1.4.0] - 2026-03-24

### Breaking Changes

- **Renamed `useDoubleQuotes` to `useQuotes`** across all options types (`ApplyOrderOptions`, `TypedWhereOptions`, `TypedWhereIsInOptions`) and method parameters.
- **Removed `Identifier` class** (`src/utils/identifier.utils.ts`) — replaced by `tableHelper` utility.
- **`tableHelper.jsonField` removed** — replaced by `jsonColumn` (full expression) and `jsonPath` (operator fragment only) with new parameter order and rest params.

### New Features

- **`tableHelper` utility** — type-safe SQL helper for building column references, WHERE expressions, JOIN clauses, and JSONB accessors.
  - `column()` — quoted SQL column identifier
  - `where()` — column with expression
  - `join()` / `joinOn()` — join path helpers
  - `isNull()` / `isNotNull()` — null check expressions
  - `count()` / `cast()` — aggregate and cast helpers
  - `jsonColumn()` — full JSONB column access expression with typed field names
  - `jsonPath()` — JSONB operator fragment for use in `whereTyped` conditions strings
- **`TypedOrderByOptions`** — new options type for `orderByTyped` and `addOrderByTyped` with `useQuotes` support.
- **JSONB support via `tableHelper`** — type-safe JSON field access with nested path support and rest params:
  ```ts
  const t = tableHelper<User>('user');
  t.jsonColumn('metadata', '->>', 'role')               // "user"."metadata" ->> 'role'
  t.jsonColumn('metadata', '->>', 'settings', 'theme')   // "user"."metadata" -> 'settings' ->> 'theme'
  t.jsonPath('metadata', '->>', 'role')                  // ->> 'role'
  ```
- **Typed JSON field names** — `jsonColumn` and `jsonPath` field names are inferred from the column's TypeScript type, providing autocomplete for JSONB keys up to 4 levels deep.

### Bug Fixes

- Fixed `addValue` defaulting to `true` even when `conditions` already includes a `:value` placeholder — now auto-detects and skips value injection when conditions contain `:`.
- Fixed `const` reassignment in `where.utils.ts` (`addValue` changed from `const` to `let`).
- Fixed `count()` stringifying `undefined` when `countExpression` is omitted.
- Fixed `count()` hardcoded double quotes — now uses `stringToSQLIdentifier` for MySQL compatibility.
- Fixed `isNull()` / `isNotNull()` producing double spaces in SQL output.
- Fixed `join()` using closure `alias` instead of `this.alias`.

### Improvements

- Added `OrderEntity extends ObjectLiteral` constraint to order extension generics.
- Added JSDoc documentation for all `tableHelper` methods.
- Added `CLAUDE.md` project overview for AI-assisted development.
- Added comprehensive test coverage for `tableHelper` (23 tests) and JSONB `whereTyped` integration (4 tests).
- Added `UserMetadata` typed JSONB column to test entity.

## [1.3.5] - 2025-12-12

### Bug Fixes

- Refactored `where.utils.ts` to only add value when param is present (not `undefined`).
- Refactored `addValue` initialization in `where.utils.ts`.

### Maintenance

- npm audit fix.

## [1.3.4] - 2025-12-12

### Maintenance

- Version bump (no functional changes).

## [1.3.3] - 2025-12-12

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
