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
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects one field, or an array of fields. Can also be an array of callbacks.
- alias?: string: Alias for the selection.
- useQuotes?: boolean: Quote the selected key (`"user"."name"`). Default `false` (`user.name`).

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
