import { tableHelper } from 'typeorm-extensions';

class Booking {
  id: number;
  startsAt: Date;
  timezone: string | null;
}

const booking = tableHelper<Booking>('booking');

booking.atTimeZone('startsAt', 'Europe/Kyiv');
booking.atTimeZone('startsAt', { column: 'timezone', fallback: 'UTC' });
booking.dateTrunc('week', { sql: 'NOW()' }, { sql: '"venue"."timezone"' });

// @ts-expect-error not a column of the entity
booking.atTimeZone('endsAt', 'UTC');
// @ts-expect-error not a column of the entity
booking.dateTrunc('day', 'startsAt', { column: 'zone' });
// @ts-expect-error not a unit of date_trunc
booking.dateTrunc('days', 'startsAt');
