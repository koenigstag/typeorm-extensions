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
- **`timeZone`** reads the days and times of the strings in a time zone, e.g. the user's: with `timeZone: 'America/New_York'`, `periodTo: '2024-01-31'` ends at midnight of February 1st in New York (`05:00` UTC). Without it, the strings go to the database as they are, which reads them in its own session time zone (`timestamptz`) or not at all (`timestamp`). See [Time zones](#time-zones).
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
  includeFrom?: boolean;     // default true
  includeTo?: boolean;       // default true
  timeZone?: string | null;  // IANA time zone, e.g. 'America/New_York'
};
```

## Arguments

- field: string: Date / time column, e.g. `'order.createdAt'`. It is quoted as an SQL identifier: `"order"."createdAt"`.
- periodFilter: PeriodFilter | null | undefined: The period.
- options.includeFrom?: boolean: `false` excludes the start: `column > periodFrom`; a date-only start excludes that whole day: `column >= <next day>`.
- options.includeTo?: boolean: `false` excludes the end: `column < periodTo`, e.g. for half-open periods `{ periodFrom: '2024-01-01', periodTo: '2024-02-01' }`.
- options.timeZone?: string | null: IANA time zone in which dates and date-times without an offset are read. Missing, `null` or `''`: none.

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

```typescript
// January 2024 in New York
// WHERE "order"."createdAt" >= $1 AND "order"."createdAt" < $2,
// $1 = 2024-01-01T05:00:00.000Z, $2 = 2024-02-01T05:00:00.000Z
query.applyPeriodFilter('order.createdAt', { periodFrom: '2024-01-01', periodTo: '2024-01-31' }, { timeZone: 'America/New_York' })
```

## Time zones

With `timeZone`, the strings are read as the wall clock of that zone and passed as instants (`Date`):

| boundary | with `timeZone: 'America/New_York'` |
|---|---|
| `'2024-01-31'` | midnight in New York: `2024-01-31T05:00:00Z` (the whole-day rules above still apply) |
| `'2024-01-31 10:00'`, `'2024-01-31T10:00:00.500'` | that time in New York |
| `'2024-01-31T10:00:00Z'`, `'2024-01-31 10:00+02:00'` | an instant already: as is |
| a `Date` | an instant already: as is |
| any other string (`'yesterday'`) | `TypeError` |

- The conversion runs in JavaScript (`Intl`), so the column stays bare in SQL and its index is used, and it works on every database.
- Daylight saving time is followed as PostgreSQL's `AT TIME ZONE` does: a day may have 23 or 25 hours, a time the clock skips is read with the offset before the transition (`'2024-03-10 02:30'` → `07:30` UTC), and a time shown twice is the later of the two.
- It is for timestamp columns. A `date` column has no time zone: filter it without `timeZone`.
- An unknown zone throws a `TypeError`, also when the period is empty, so a wrong zone from configuration is caught at once.

For a typesafe version that takes the column from an entity property, see [applyPeriodFilterTyped](../typed/applyPeriodFilterTyped.md).
