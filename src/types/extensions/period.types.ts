export type ApplyPeriodOptions = {
  /**
   * Make `periodTo` exclusive: `field < periodTo`, with no whole-day expansion of date-only strings,
   * for half-open periods such as `{ periodFrom: '2024-01-01', periodTo: '2024-02-01' }`.
   * Defaults to `false`.
   */
  periodToExclusive?: boolean;
};
