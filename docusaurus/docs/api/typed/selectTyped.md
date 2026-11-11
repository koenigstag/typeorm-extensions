---
sidebar_position: 2
---

# selectTyped

## Description
`selectTyped` is a method that applies typesafe select to a query, replacing previous selections. `addSelectTyped` adds to them.

## Signature
```typescript
selectTyped(
  selection: KeyProxyCallback<Entity>,
  alias?: string,
  useQuotes?: boolean
): SelectQueryBuilder<Entity>

selectTyped(
  selection: Array<KeyProxyCallback<Entity>>,
  useQuotes?: boolean
): SelectQueryBuilder<Entity>

addSelectTyped(...): SelectQueryBuilder<Entity> // same overloads
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one field, or an array of fields. Can also be an array of callbacks. A path into a JSON column (`user => user.metadata.role`) throws a `TypeError`: for a JSON value use [tableHelper](../utils/tableHelper.md#jsonb) `jsonColumn`.
- alias?: string: Alias for the selection.
- useQuotes?: boolean: Quote the selected key with its database column name (`"user"."name"`, `@Column({ name })` applied). Without it: `user.name`, which TypeORM maps to the column itself. An alias without metadata, a subquery or a table in FROM or a join that isn't an entity (`.from('recent_events', 'recentEvents')`), is quoted unless `useQuotes: false` is passed: TypeORM leaves its keys as written, and PostgreSQL folds an unquoted `recentEvents.startsAt` to `recentevents.startsat`. An alias the query adds after the call is handled the same way once it is added: TypeORM maps the keys of an entity's alias, and those of a subquery or a CTE are quoted. On PostgreSQL a column that raw SQL names without quotes (`AS userId`) is `userid`: quote it in the SQL (`AS "userId"`) or pass `useQuotes: false`.

## Usage

```typescript
// same as `query.select('user.name', 'fullName')`
query.selectTyped(user => user.name, 'fullName')
```

```typescript
// same as `query.select(['user.id', 'user.name'])`
query.selectTyped(user => [
  user.id,
  user.name,
])
```

```typescript
// same as `query.select(['user.id', 'images.url'])`
query
  .leftJoinTyped(user => user.images, 'images')
  .selectTyped([
    user => user.id,
    user => user.images.url,
  ])
```

```typescript
// same as `query.addSelect('user.createdAt', 'registeredAt')`
query.addSelectTyped(user => user.createdAt, 'registeredAt')
```

```typescript
// same as `query.select('"user"."name"', 'fullName')`
query.selectTyped(user => user.name, 'fullName', true)
```

```typescript
// before from(): address the column by its alias, the query has no main alias yet
// same as `dataSource.createQueryBuilder().select('base.chatRoomId').from(ChatMessage, 'base')`
dataSource
  .createQueryBuilder()
  .selectTyped<{ base: ChatMessage }>((q) => q.base.chatRoomId)
  .from(ChatMessage, 'base')
```

See [KeyProxyCallback](./types/KeyProxyCallback.md#before-from) for keys before `from()`.

## Column order

TypeORM treats a selection of the form `alias.property` as an entity column. It moves such selections to the front of the select list, in the entity's column order, ahead of other expressions. This applies to `selectTyped`, which emits `user.email`, as well as to a plain `select('user.email')`:

```typescript
query
  .select("'user'", 'kind')
  .addSelectTyped(user => user.email, 'email')
  .addSelectTyped(user => user.id, 'id')
// SELECT "user"."id" AS "id", "user"."email" AS "email", 'user' AS "kind"
```

That's harmless wherever columns are read by name (`getRawMany`, CTEs, `LATERAL` joins), but a `UNION` matches columns **by position**, so its branches may end up with mismatched columns.

To keep the order as written, pass `useQuotes`. A quoted key isn't recognized as an entity column, so it stays where it was added:

```typescript
query
  .select("'user'", 'kind')
  .addSelectTyped(user => user.email, 'email', true)
  .addSelectTyped(user => user.id, 'id', true)
// SELECT 'user' AS "kind", "user"."email" AS "email", "user"."id" AS "id"
```

Quoted selections are plain expressions for TypeORM and aren't mapped to entity properties: read them with `getRawMany()` / `getRawOne()`, as you would the result of a `UNION`. [tableHelper](../utils/tableHelper.md) `column()` returns the same quoted form.
