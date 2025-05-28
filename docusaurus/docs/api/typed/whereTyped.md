---
sidebar_position: 4
---

# whereTyped

## Description
`whereTyped` is a method that applies typesafe condition to a query.

## Signature
```typescript
whereTyped(
  selection: KeyProxyCallback<Entity>,
  condition?: string,
  params?: unknown
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The callback which selects fields of entity.
- condition?: string: Operator for the query. This shold not contain `:key` if options.addValue is set `true`.
- params?: unknown: Parameter for the condition. This can be an object `{ someValue: 'value' }` or the value itself `'value'`.
- options?: { addValue?: boolean }: Options for where logic.
- options.addValue?: boolean: The `addValue` option is controlling whether it will paste **random uniq placeholder** to condition (if true) or work as default requiring you to pass placeholder yourself (if false). Supports primitive values (placeholder `:key`), array (placeholder `(:...key)`) and param object with one entry (takes first entry). Default `true`.

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
// same as `query.orWhere('user.name LIKE :name', { name: '%John Doe%' })`
query
  .orWhereTyped(
    user => user.name,
    'LIKE :search',
    { search: '%John Doe%' },
    { addValue: false }
  )
```
