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
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one column, or several at once (`user => [user.id, user.email]`); each of them goes into GROUP BY. A relation as a whole (`user => user.images`) is no column and doesn't compile. The callback starts at the entity, or at the root set with `typed<Root>()`. Columns of joined relations work too (`user => user.images.url`). A path into a JSON column (`user => user.metadata.role`) throws a `TypeError` and leaves GROUP BY as it was.
- options?: `TypedGroupByOptions`: `{ useQuotes?: boolean }`. With `useQuotes: true` the key is the quoted database column (`"ticket"."ticket_status"`, `@Column({ name })` applied) instead of `ticket.status`. Without it: `ticket.status`, which TypeORM maps to the column itself. An alias without metadata, a subquery or a table in FROM or a join that isn't an entity (`.from('recent_events', 'recentEvents')`), is quoted unless `useQuotes: false` is passed: TypeORM leaves its keys as written, and PostgreSQL folds an unquoted `recentEvents.startsAt` to `recentevents.startsat`. An alias the query doesn't know yet when the method is called isn't quoted. On PostgreSQL a column that raw SQL names without quotes (`AS userId`) is `userid`: quote it in the SQL (`AS "userId"`) or pass `useQuotes: false`.

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
