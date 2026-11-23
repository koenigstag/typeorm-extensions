---
sidebar_position: 6
---

# getRawManyWithCursor

## Description

[getManyWithCursor](./getManyWithCursor.md) for raw rows: a page of `getRawMany()` with keyset (cursor) pagination. The keys are SQL expressions, not properties of an entity, so a row can be ordered by a value the query computes:

```sql
WHERE ((CASE "member"."role" WHEN 'owner' THEN 0 ELSE 1 END), ("member"."createdAt"), ("member"."id")) > ($1, $2, $3)
ORDER BY CASE "member"."role" WHEN 'owner' THEN 0 ELSE 1 END ASC, "member"."createdAt" ASC, "member"."id" ASC
LIMIT 21
```

How it differs from `getManyWithCursor`:

- A key is any expression valid in WHERE: a column (`member.createdAt`, `"member"."created_at"`), or a computed value such as a `CASE`. Not an aggregate: the cursor condition goes in WHERE, which runs before grouping.
- The primary key of the main alias is appended when the query is on an entity and has no `GROUP BY` and no `DISTINCT`. Otherwise the last key has to be unique per row, e.g. the column a query is grouped by, or rows with equal keys may be skipped or repeated between pages. A query that joins a collection returns several rows per entity, so its keys need a column of the joined table too.
- The page is paged with `LIMIT`: there is no `useTakeAndSkip`.
- A key can also name a selection of the query by its alias, `{ alias: 'score' }`: its SQL is the key, with the parameters it already has. That is how a score of [addSimilarityScoreTyped](../typed/whereSimilarTyped.md) or any `addSelect(sql, alias)` becomes a key without writing its SQL twice.
- The cursor names its keys by a hash of their SQL (`sql:1f3a9c2e`, `-sql:1f3a9c2e` for a `DESC` key), so it carries no SQL. Changing the SQL or the direction of a key makes earlier cursors invalid. The names of the query's parameters are left out of the hash: a key with a generated parameter name (`similarity(…, :similarity_ab12c)`) gets a new one on every request, and its cursor still fits.
- Each key is also read as text, and the cursor takes the text when the driver returns a JS `Date`, so timestamps keep the database's precision (PostgreSQL microseconds).
- The rows don't include the columns read for the cursor.

Everything else is as in `getManyWithCursor`: `pageSize + 1` rows tell whether there is a next page, the cursor condition narrows the whole WHERE clause, key values must not be `NULL`, and the query builder itself is not changed.

To page by an aggregate (`ORDER BY COUNT(*)`), select it in a query and page an outer query over it, where it is a column.

## Signature

```typescript
getRawManyWithCursor<Row = ObjectLiteral>(
  cursorFilter: CursorPaginationFilter | null | undefined,
  options: GetRawManyWithCursorOptions
): Promise<ListWithCursor<Row>>

type GetRawManyWithCursorOptions = {
  orderBy: Array<{ selector: string; direction?: OrderDirection } | { alias: string; direction?: OrderDirection }>;
  includeOrderBy?: boolean; // add orderBy to the result
};
```

`ListWithCursor` is the result of [getManyWithCursor](./getManyWithCursor.md), with the raw rows in `list`, and with `includeOrderBy` the SQL keys in `orderBy`.

## Arguments

- cursorFilter: The cursor and the page size, e.g. from query parameters.
- options.orderBy: SQL expressions to order by, or aliases of selections of the query, with `'ASC'` (default) or `'DESC'` (any `OrderDirection`). An empty selector, an alias the query doesn't select, or a key with both throws a `TypeError`, and so does an empty `orderBy` on a query with no primary key to append.
- options.includeOrderBy: Add `orderBy` to the result. Off by default, as its selectors are SQL.

## Errors

A cursor that can't be decoded, or that was made for another `orderBy`, throws `InvalidCursorError`, as with `getManyWithCursor`.

## Usage

```typescript
// owners first, then moderators, then the other members, each in the order they joined
const rank = `CASE member.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END`;

const page = await repository
  .createQueryBuilder('member')
  .select('member.id', 'id')
  .addSelect('member.role', 'role')
  .addSelect('member.createdAt', 'joinedAt')
  .where('member.roomId = :roomId', { roomId })
  .getRawManyWithCursor<{ id: string; role: string; joinedAt: Date }>(
    { cursor: query.cursor, pageSize: 20 },
    { orderBy: [{ selector: rank }, { selector: 'member.createdAt' }] },
  );

// {
//   list: [{ id, role, joinedAt }, …],
//   nextCursor: 'eyJrIjpb…' | null,
//   hasMore: true | false,
//   pageSize: 20,
// }
```

```typescript
// grouped rows: the group key is unique per row, so nothing is appended
query
  .select('order.userId', 'userId')
  .addSelect('SUM(order.amount)', 'spent')
  .groupBy('order.userId')
  .getRawManyWithCursor(filter, { orderBy: [{ selector: 'order.userId' }] })
```

```typescript
// the most similar first, by the alias of the score (PostgreSQL, pg_trgm); a NULL key would throw, hence nullScore
query
  .select('product.id', 'id')
  .addSimilarityScoreTyped(p => p.name, dto.search, 'score', { nullScore: 0 })
  .getRawManyWithCursor(filter, { orderBy: [{ alias: 'score', direction: 'DESC' }] })
```
