import { DatabaseType } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest } from '../test-utils';
import { postgresLikeDrivers } from '../constants/database';

class OrderRow {
  id: number;
  paidAt: Date;
  timezone: string | null;
}

describe('tableHelper time SQL', () => {
  const order = (driver?: DatabaseType) => tableHelper<OrderRow>('order', { driver });

  it('SHOULD write the time zone as an escaped literal, a column with a fallback, or SQL', () => {
    expect(order().atTimeZone('paidAt', 'Europe/Kyiv')).toBe(`("order"."paidAt" AT TIME ZONE 'Europe/Kyiv')`);
    // a zone from a request can't close the literal
    expect(order().atTimeZone('paidAt', "UTC'; DROP TABLE orders; --")).toBe(
      `("order"."paidAt" AT TIME ZONE 'UTC''; DROP TABLE orders; --')`,
    );
    expect(order().atTimeZone('paidAt', { column: 'timezone', fallback: 'UTC' })).toBe(
      `("order"."paidAt" AT TIME ZONE COALESCE("order"."timezone", 'UTC'))`,
    );
    expect(order().atTimeZone({ sql: 'MAX("order"."paidAt")' }, { sql: '"venue"."timezone"' })).toBe(
      `(MAX("order"."paidAt") AT TIME ZONE "venue"."timezone")`,
    );
  });

  it('SHOULD write an ISO offset as the POSIX zone of the same offset', () => {
    // PostgreSQL reads a bare '+02:00' as UTC-2
    expect(order().atTimeZone('paidAt', '+02:00')).toBe(`("order"."paidAt" AT TIME ZONE '<+0200>-02:00')`);
    expect(order().dateTrunc('day', 'paidAt', { column: 'timezone', fallback: '-0330' })).toBe(
      `date_trunc('day', "order"."paidAt", COALESCE("order"."timezone", '<-0330>+03:30'))`,
    );
  });

  it('SHOULD truncate, in a time zone with the three-argument form', () => {
    expect(order().dateTrunc('day', 'paidAt')).toBe(`date_trunc('day', "order"."paidAt")`);
    expect(order().dateTrunc('month', 'paidAt', { column: 'timezone' })).toBe(
      `date_trunc('month', "order"."paidAt", "order"."timezone")`,
    );
  });

  it('SHOULD reject an unknown unit, an empty zone, and databases other than PostgreSQL', () => {
    expect(() => order().dateTrunc('days' as 'day', 'paidAt')).toThrow(/the unit is one of/);
    expect(() => order().atTimeZone('paidAt', ' ')).toThrow(/the time zone is empty/);
    expect(() => order('mysql').atTimeZone('paidAt', 'UTC')).toThrow(/PostgreSQL only, the driver is "mysql"/);
    expect(() => order('better-sqlite3').dateTrunc('day', 'paidAt')).toThrow(/PostgreSQL only/);
    expect(() => order('mssql').atTimeZone('paidAt', 'UTC')).toThrow(/PostgreSQL only, the driver is "mssql"/);
  });
});

setupTest('tableHelper time queries', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only runs on PostgreSQL', () => undefined);
    return;
  }

  const t = tableHelper<OrderRow>('order');
  // 22:30 UTC on March 1st is 00:30 on March 2nd in Kyiv (UTC+2 until the end of March)
  const paidAt = { sql: `CAST('2026-03-01T22:30:00Z' AS timestamptz)` };
  // text in UTC, independent of the session's time zone and of the driver's Date parsing
  const utc = (sql: string) => `CAST((${sql}) AT TIME ZONE 'UTC' AS text)`;

  it('SHOULD give the wall-clock time, and the local day boundary, of a zone', async () => {
    const [row] = await context.dataSource.query(
      `SELECT CAST(${t.atTimeZone(paidAt, 'Europe/Kyiv')} AS text) AS "local",
        ${utc(t.dateTrunc('day', paidAt, 'UTC'))} AS "utcDay",
        ${utc(t.dateTrunc('day', paidAt, 'Europe/Kyiv'))} AS "kyivDay",
        CAST(${t.atTimeZone(paidAt, '+02:00')} AS text) AS "offsetLocal",
        ${utc(t.dateTrunc('day', paidAt, '+02:00'))} AS "offsetDay"`,
    );

    expect(row).toEqual({
      local: '2026-03-02 00:30:00',
      utcDay: '2026-03-01 00:00:00',
      // the Kyiv midnight of March 2nd, in UTC
      kyivDay: '2026-03-01 22:00:00',
      // +02:00 is Kyiv's offset in March
      offsetLocal: '2026-03-02 00:30:00',
      offsetDay: '2026-03-01 22:00:00',
    });
  });
});
