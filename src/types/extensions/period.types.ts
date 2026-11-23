export type ApplyPeriodOptions = {
  /**
   * Include the start of the period (default `true`): `field >= periodFrom`.
   * With `false`: `field > periodFrom`, and a date-only `periodFrom` (`'2024-01-01'`) excludes that
   * whole day: `field >= '2024-01-02'`.
   */
  includeFrom?: boolean;
  /**
   * Include the end of the period (default `true`): `field <= periodTo`, and a date-only `periodTo`
   * (`'2024-01-31'`) includes that whole day: `field < '2024-02-01'`.
   * With `false`: `field < periodTo`, a half-open period such as
   * `{ periodFrom: '2024-01-01', periodTo: '2024-02-01' }`.
   */
  includeTo?: boolean;
  /**
   * IANA time zone (`'America/New_York'`) in which a date (`'2024-01-31'`) and a date-time without an offset
   * (`'2024-01-31 10:00'`) are read: `periodTo: '2024-01-31'` ends at midnight of February 1st in that zone.
   * They become instants (`Date`), so it is for timestamp columns, not `date` ones. `Date`s and strings with
   * an offset are instants already and stay as they are; other strings throw a `TypeError`, as does an
   * unknown zone. Missing, `null` or `''`: the strings go to the database as they are.
   */
  timeZone?: string | null;
};
