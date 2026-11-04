/** A period boundary: a `Date`, or a date / timestamp string the database understands (`'2024-01-31'`). */
export type PeriodBoundary = Date | string;

/**
 * A period to filter rows by, e.g. from query parameters. Both ends are optional and inclusive:
 * `periodFrom` → `field >= periodFrom`, `periodTo` → `field <= periodTo`.
 * A date-only `periodTo` string (`'2024-01-31'`) includes that whole day: `field < '2024-02-01'`.
 */
export interface PeriodFilter {
  periodFrom?: PeriodBoundary;
  periodTo?: PeriodBoundary;
}
