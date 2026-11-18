---
sidebar_position: 1.5
---

# selectRow / unnestRows

## Description
A CTE or subquery is read through a `tableHelper` typed with its row, `tableHelper<Record<'userId' | 'visits', unknown>>('visits')`. `selectRow` and `unnestRows` build its body from the same helper, so the columns the body writes and the columns the outer query reads are checked against one type: a missing, extra or misspelled column fails type-check on either side.

- `selectRow(table, columns)` replaces the selection of a `SelectQueryBuilder` with `<sql> AS "<column>"` for each column of the row, in the order of `columns`.
- `unnestRows(table, arrays, options?)` (from `typeorm-extensions/helpers`) returns `SELECT * FROM unnest(<array>, …) AS t("<column>", …)`: rows zipped from arrays, one per column. `{ ordinality: 'ord' }` adds `WITH ORDINALITY` and names the numbering column, which takes no array. PostgreSQL only.
- Only the helper's type is read, not its alias: one row type may be read under several aliases.
- A row without columns throws a `TypeError`.

## Signature
```typescript
selectRow<Row>(table: TableRow<Row>, columns: { [K in keyof Row]: string }): this

unnestRows<Row, Ordinality extends keyof Row = never>(
  table: TableRow<Row>,
  arrays: { [K in Exclude<keyof Row, Ordinality>]: string },
  options?: { ordinality: Ordinality },
): string
```

## Usage

```typescript
const visits = tableHelper<Record<'userId' | 'visits' | 'lastVisit', unknown>>('visits');
const checkIn = tableHelper(CheckIn, 'checkIn');

const visitsQuery = checkInRepository
  .createQueryBuilder('checkIn')
  // SELECT "checkIn"."customer_id" AS "userId", COUNT(*) AS "visits", MAX("checkIn"."checked_in_at") AS "lastVisit"
  .selectRow(visits, {
    userId: checkIn.customerId,
    visits: 'COUNT(*)',
    lastVisit: `MAX(${checkIn.checkedInAt})`,
  })
  .groupBy(checkIn.customerId);

userRepository
  .createQueryBuilder('user')
  .addCommonTableExpression(visitsQuery, 'visits_cte')
  .leftJoin('visits_cte', 'visits', `${visits.userId} = "user"."id"`)
  .addSelect(visits.visits, 'visits');
```

```typescript
const batch = tableHelper<Record<'userId' | 'orderDate', unknown>>('batch');

query.addCommonTableExpression(
  // SELECT * FROM unnest(:userIds::uuid[], :orderDates::timestamptz[]) AS t("userId", "orderDate")
  unnestRows(batch, { userId: ':userIds::uuid[]', orderDate: ':orderDates::timestamptz[]' }),
  'batch',
);
```
