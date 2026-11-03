---
sidebar_position: 4
---

# whereTyped

## Description
`whereTyped` is a method that applies typesafe condition to a query.

Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`, together with `andWhereTyped` and `orWhereTyped`. On `UpdateQueryBuilder` / `DeleteQueryBuilder` the column isn't prefixed with an alias (`UPDATE "users" … WHERE "firstName" = …`), since UPDATE / DELETE statements have none.

## Signature
```typescript
whereTyped(
  selection: KeyProxyCallback<Entity>,
  condition?: string,
  params?: unknown,
  options?: { addValue?: boolean }
): SelectQueryBuilder<Entity>

andWhereTyped(selection, condition?, params?, options?): SelectQueryBuilder<Entity>
orWhereTyped(selection, condition?, params?, options?): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects fields of entity.
- condition?: string: Operator for the query. It may reference a key of `params` as a placeholder (`:key` or `(:...keys)`); then the value is not appended automatically.
- params?: unknown: Parameter for the condition. This can be an object `{ someValue: 'value' }` or the value itself `'value'`.
- options?: \{ addValue?: boolean \}: Options for where logic.
- options.addValue?: boolean: The `addValue` option is controlling whether it will paste **random uniq placeholder** to condition (if true) or work as default requiring you to pass placeholder yourself (if false). Supports primitive values (placeholder `:key`), array (placeholder `(:...key)`) and param object with one entry (takes first entry). Defaults to `true`, or to `false` when `condition` already references a key of `params` (e.g. `'LIKE :search'` with `{ search: '%John%' }`).

Like TypeORM's `where`, `whereTyped` replaces previously set WHERE conditions; use `andWhereTyped` / `orWhereTyped` to add to them.

## Usage

```typescript
// same as `query.where('user.name LIKE :name', { name: '%John%' })`
query
  .whereTyped(
    user => user.name,
    'LIKE',
    '%John%',
  )
```

```typescript
// same as `query.andWhere('user.name LIKE :name', { name: '%Doe%' })`
query
  .andWhereTyped(
    user => user.name,
    'LIKE',
    { name: '%Doe%' },
  )
```

```typescript
// same as `query.orWhere('user.name LIKE :search', { search: '%John Doe%' })`
// `:search` is a key of params, so no extra placeholder is appended
query
  .orWhereTyped(
    user => user.name,
    'LIKE :search',
    { search: '%John Doe%' },
  )
```

```typescript
// arrays get a `(:...key)` placeholder
// same as `query.where('user.id IN (:...ids)', { ids: [1, 2, 3] })`
query.whereTyped(user => user.id, 'IN', [1, 2, 3])
```

```typescript
// columns of joined relations, including array relations (`images: ImageEntity[]`)
// same as `query.andWhere('images.url IS NOT NULL')`
query
  .leftJoinTyped(user => user.images, 'images')
  .andWhereTyped(user => user.images.url, 'IS NOT NULL')
```

```typescript
// JSONB fields with tableHelper
import { tableHelper } from 'typeorm-extensions';

const t = tableHelper<UserEntity>('user');

// same as `query.where("user.metadata ->> 'role' = :role", { role: 'admin' })`
query.whereTyped(
  user => user.metadata,
  `${t.jsonPath('metadata', '->>', 'role')} =`,
  'admin',
)
```
