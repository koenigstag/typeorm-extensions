---
sidebar_position: 4
---

# getManyWithCursor

## Description

`getManyWithCursor` loads a page with **keyset (cursor) pagination**. Instead of skipping rows with OFFSET, it loads the rows after the last row of the previous page:

```sql
WHERE ("user"."createdAt", "user"."id") < ($1, $2)
ORDER BY "user"."createdAt" DESC, "user"."id" DESC
LIMIT 11
```

- Every page is as fast as the first one with an index on the key columns, where OFFSET reads and drops all the rows before the page.
- Rows inserted or deleted between requests don't shift the pages: no row is repeated or skipped.
- Pages go forward only: there is a `nextCursor`, no page numbers and no total.

How it works:

- The rows are ordered by `options.orderBy`, and the primary key is appended when it isn't listed, so the order is total even when the other keys repeat. It replaces any ORDER BY of the query.
- With the same direction on every key, the condition is a row comparison `(a, b) < (:a, :b)` (PostgreSQL, MySQL, SQLite); with mixed directions it is `a <= :a AND (a < :a OR (a = :a AND b > :b))`.
- `pageSize + 1` rows are loaded; the extra one only tells whether there is a next page, which is what `hasMore` reports. It is always a boolean here, never `null` as in [ListWithTotals](./types/ListWithTotals.md), because the keyset query needs no total to know it.
- The cursor is opaque (base64url JSON of the key values of the last row). Date / time keys are read from the database as text, so PostgreSQL's microsecond timestamps keep their precision; a JS `Date` has only milliseconds and would skip rows.
- The cursor condition narrows the whole WHERE clause: existing OR conditions are put in parentheses first.
- The query builder itself is not changed.

Key columns must not be `NULL`.

## Signature

```typescript
getManyWithCursor(
  cursorFilter: CursorPaginationFilter | null | undefined,
  options: GetManyWithCursorOptions<Entity>
): Promise<ListWithCursor<Entity>>

interface CursorPaginationFilter {
  cursor?: string | null; // nextCursor of the previous page; empty for the first page
  pageSize?: number;      // 10 by default
}

type GetManyWithCursorOptions<Entity> = {
  orderBy: Array<{ field: keyof Entity; direction?: OrderDirection }>;
  useTakeAndSkip?: boolean; // take instead of limit, for joined collections
};

interface ListWithCursor<Entity> {
  list: Entity[];
  nextCursor: string | null; // null on the last page
  hasMore: boolean;          // whether a next page follows; same as nextCursor !== null
  pageSize: number;          // the pageSize given (a numeric string too), rounded down; 10 when missing or below 1
  orderBy: OrderType[];      // options.orderBy, then the primary key: [{ selector: 'post.createdAt', order: 'DESC' }, …]
}
```

`orderBy` is the order the cursors of these pages encode, as `alias.property` selectors. Like the `orderBy` of [ListWithTotals](./types/ListWithTotals.md), it is for logs and debugging, not for the client to send back.

## Arguments

- cursorFilter: The cursor and the page size, e.g. from query parameters.
- options.orderBy: Properties of the main entity to order by, with `'ASC'` (default) or `'DESC'` (any `OrderDirection`: `'desc'`, `-1`, `false`, …). An unknown property throws a `TypeError`.
- options.useTakeAndSkip: Use `take` instead of `limit`. Needed when the query joins a collection (`leftJoinAndSelect(user.images)`), as with [applyPaginationFilter](./applyPaginationFilter.md).

## Errors

A cursor that can't be decoded, or that was made for another `orderBy`, throws `InvalidCursorError` (a `TypeError`, exported from the package), e.g. to answer with 400:

```typescript
import { InvalidCursorError } from 'typeorm-extensions';
```

## Usage

```typescript
// GET /feed?cursor=…&pageSize=20
const page = await repository
  .createQueryBuilder('post')
  .where('post.published = true')
  .getManyWithCursor(
    { cursor: query.cursor, pageSize: 20 },
    { orderBy: [{ field: 'createdAt', direction: 'DESC' }] },
  );

// {
//   list: Post[],
//   nextCursor: 'eyJrIjpb…' | null,
//   hasMore: true | false,
//   pageSize: 20,
//   orderBy: [{ selector: 'post.createdAt', order: 'DESC' }, { selector: 'post.id', order: 'DESC' }],
// }
```

```typescript
// with joined collections
query
  .leftJoinAndSelect('user.images', 'images')
  .getManyWithCursor(filter, { orderBy: [{ field: 'name' }], useTakeAndSkip: true })
```
