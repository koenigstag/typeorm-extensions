/** A period boundary: a `Date`, or a date / timestamp string the database understands (`'2024-01-31'`). */
export type PeriodBoundary = Date | string;

/**
 * A period to filter rows by, e.g. from query parameters. Both ends are optional and,
 * by default, inclusive: `periodFrom` → `field >= periodFrom`, `periodTo` → `field <= periodTo`.
 * A date-only string (`'2024-01-31'`) stands for the whole day: `periodTo: '2024-01-31'`
 * → `field < '2024-02-01'`. See `ApplyPeriodOptions` to exclude either end.
 */
export interface PeriodFilter {
  periodFrom?: PeriodBoundary;
  periodTo?: PeriodBoundary;
}
