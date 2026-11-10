---
sidebar_position: 6.7
---

# groupByTyped

## Description
`groupByTyped` sets GROUP BY to the columns a callback selects. `addGroupByTyped` adds them to the existing GROUP BY.

## Signature
```typescript
groupByTyped(
  selection: KeyProxyCallback<Entity>,
  options?: TypedGroupByOptions
): SelectQueryBuilder<Entity>

addGroupByTyped(
  selection: KeyProxyCallback<Entity>,
  options?: TypedGroupByOptions
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one column, or several at once (`user => [user.id, user.email]`); each of them goes into GROUP BY. Columns of joined relations work too (`user => user.images.url`). A path into a JSON column (`user => user.metadata.role`) throws a `TypeError` and leaves GROUP BY as it was.
- options?: `TypedGroupByOptions`: `{ useQuotes?: boolean }`. With `useQuotes: true` the key is the quoted database column (`"ticket"."ticket_status"`, `@Column({ name })` applied) instead of `ticket.status`. Default `false`: `ticket.status`, which TypeORM maps to the column itself. TypeORM maps keys only for aliases with metadata, so group the columns of a subquery in FROM with `useQuotes`: PostgreSQL folds an unquoted `sub.firstName` to `firstname`.

## Usage

```typescript
// same as `query.groupBy('user.id')`
query
  .leftJoinTyped(user => user.images, 'images')
  .select('user.id', 'id')
  .addSelect('COUNT(images.id)', 'imagesCount')
  .groupByTyped(user => user.id)
```

```typescript
// same as `query.groupBy('user.id').addGroupBy('user.email')`
query.groupByTyped(user => [user.id, user.email])
```

```typescript
// same as `query.addGroupBy('images.url')`
query.addGroupByTyped(user => user.images.url)
```

```typescript
// same as `query.groupBy('"ticket"."ticket_status"')`
query.groupByTyped(ticket => ticket.status, { useQuotes: true })
```
