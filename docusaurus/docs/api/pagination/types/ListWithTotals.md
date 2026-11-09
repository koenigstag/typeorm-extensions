---
sidebar_position: 6
---

# interface ListWithTotals

## Description

`ListWithTotals<Entity>` is the result of [getManyWithTotals](../getManyWithTotals.md).

## Definition

```typescript
interface ListWithTotals<Entity> {
  list: Entity[];
  total: number | null;
  limit: number | null;
  offset: number | null;
  hasMore: boolean | null;
  orderBy: OrderType[];
}
```

- `list`: entities of the requested page (or all of them with `loadAll`).
- `total`: number of all rows matching the query, or `null` with `disableTotalsCalculation`.
- `limit`: page size that was applied, or `null` with `loadAll`.
- `offset`: number of skipped rows, or `null` with `loadAll`.
- `hasMore`: whether rows follow the page. With a total it is `offset + list.length < total`; with `disableTotalsCalculation` the page is read one row longer and the extra row is dropped, so it is known without counting. `null` only with `loadAll`, where the page is every row. [getManyWithCursor](../getManyWithCursor.md) works the same way and always knows it.
- `orderBy`: the ORDER BY of the query, as SQL — useful for logs and debugging. Its `selector` is the SQL selector, not a property of the entity: `orderByTyped` gives `"user"."created_at"`, `orderByArrayPosition` a generated `array_position_…` alias, and a raw `.orderBy('CASE …')` the expression itself. Don't put it in an API response for the client to send back as an [OrderParam](../../order/types/OrderParam.md); the names are the database's, not the entity's.
  Without an explicit order it is the `orderBy` of `@Entity`, which is what the SQL falls back to; empty only when the query also sets the `disable-global-order` option.

## Example

```typescript
const result: ListWithTotals<UserEntity> = await query.getManyWithTotals({ page: 3, pageSize: 10 });

const pagesCount = result.total === null ? undefined : Math.ceil(result.total / 10);

// `hasMore` saves comparing the total yourself
if (result.hasMore) {
  // … render a "load more" control
}

// `orderBy` is the SQL order, for a log line — not for the API response
logger.debug('page ordered by', result.orderBy.map(({ selector, order }) => `${selector} ${order}`));
```
