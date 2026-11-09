---
sidebar_position: 7
---

# applyPeriodFilter

## Description

`applyPeriodFilter` filters rows by a period of a date / time column, given as a `PeriodFilter` (e.g. from query parameters):

```typescript
interface PeriodFilter {
  periodFrom?: Date | string;
  periodTo?: Date | string;
}
```

- Both ends are optional; a missing, `null` or empty (`''`) end is skipped, and an empty or missing filter adds nothing. So open-ended periods ("since", "until") work, and the filter can be applied unconditionally.
- Both ends are **inclusive** by default: `column >= periodFrom AND column <= periodTo`. Use `includeFrom` / `includeTo` to exclude either end.
- A **date-only string** (`'2024-01-31'`) stands for the whole day, also on timestamp columns: `periodTo: '2024-01-31'` becomes `column < '2024-02-01'`, so January 31st 18:00 is included. (`column <= '2024-01-31'` would compare with midnight and drop the rest of the day.)
- A `Date`, or a string with a time (`'2024-01-31 12:00:00'`), is an exact bound.
- The conditions are added with AND and narrow the whole WHERE clause: after `.where(a).orWhere(b)` the result is `(a OR b) AND …`, not `a OR (b AND …)` as with TypeORM's `andWhere`.
- An invalid `Date` or a date-only string that isn't a calendar date (`'2024-02-30'`) throws a `TypeError`.

Works on every database. Available on `SelectQueryBuilder`, `UpdateQueryBuilder` and `DeleteQueryBuilder`.

## Signature

```typescript
applyPeriodFilter(
  field: string,
  periodFilter: PeriodFilter | null | undefined,
  options?: ApplyPeriodOptions
): this

type ApplyPeriodOptions = {
  includeFrom?: boolean; // default true
  includeTo?: boolean;   // default true
};
```

## Arguments

- field: string: Date / time column, e.g. `'order.createdAt'`. It is quoted as an SQL identifier: `"order"."createdAt"`.
- periodFilter: PeriodFilter | null | undefined: The period.
- options.includeFrom?: boolean: `false` excludes the start: `column > periodFrom`; a date-only start excludes that whole day: `column >= <next day>`.
- options.includeTo?: boolean: `false` excludes the end: `column < periodTo`, e.g. for half-open periods `{ periodFrom: '2024-01-01', periodTo: '2024-02-01' }`.

| | included (default) | excluded |
|---|---|---|
| `periodFrom: '2024-01-01'` | `>= '2024-01-01'` | `>= '2024-01-02'` |
| `periodTo: '2024-01-31'` | `< '2024-02-01'` | `< '2024-01-31'` |
| `periodFrom: Date` | `>= :date` | `> :date` |
| `periodTo: Date` | `<= :date` | `< :date` |

## Usage

```typescript
// January 2024, the 31st included
// WHERE "order"."createdAt" >= '2024-01-01' AND "order"."createdAt" < '2024-02-01'
query.applyPeriodFilter('order.createdAt', { periodFrom: '2024-01-01', periodTo: '2024-01-31' })
```

```typescript
// straight from a DTO: missing ends are skipped
query.applyPeriodFilter('order.createdAt', dto)
```

```typescript
// half-open period
query.applyPeriodFilter('order.createdAt', { periodFrom: start, periodTo: end }, { includeTo: false })
```

For a typesafe version that takes the column from an entity property, see [applyPeriodFilterTyped](../typed/applyPeriodFilterTyped.md).
