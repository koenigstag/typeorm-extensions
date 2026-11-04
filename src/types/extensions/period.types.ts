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
};
