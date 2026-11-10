const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_FORMATTERS = 500;

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/;
const DATE_TIME_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);

  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        era: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } catch {
      throw new TypeError(`Invalid timeZone "${timeZone}": not an IANA time zone`);
    }

    // the keys are caller input: Intl accepts any letter case of a zone name
    if (formatters.size >= MAX_CACHED_FORMATTERS) {
      formatters.clear();
    }

    formatters.set(timeZone, formatter);
  }

  return formatter;
}

/** The wall clock of an instant in a time zone, as milliseconds of the same wall clock in UTC. */
function getWallClock(instant: number, timeZone: string): number {
  const parts: Record<string, string> = {};

  for (const { type, value } of getFormatter(timeZone).formatToParts(new Date(instant))) {
    parts[type] = value;
  }

  const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  const wallClock = new Date(0);
  // some ICU versions write midnight as 24 with hour12: false
  wallClock.setUTCFullYear(year, Number(parts.month) - 1, Number(parts.day));
  wallClock.setUTCHours(Number(parts.hour) % 24, Number(parts.minute), Number(parts.second), 0);

  return wallClock.getTime() + (((instant % 1000) + 1000) % 1000);
}

/**
 * The instant at which the wall clock of a time zone shows `wallClock` (milliseconds of that wall clock in
 * UTC). Like PostgreSQL: a time skipped by a forward transition takes the offset before it, and a time that
 * occurs twice is read with the offset after the transition, the later of the two instants.
 */
function wallClockToInstant(wallClock: number, timeZone: string): number {
  const offsets = new Set(
    [wallClock - DAY_MS, wallClock, wallClock + DAY_MS].map(
      (instant) => getWallClock(instant, timeZone) - instant
    )
  );
  const candidates = [...offsets].map((offset) => wallClock - offset);
  const matching = candidates.filter((instant) => getWallClock(instant, timeZone) === wallClock);

  return Math.max(...(matching.length > 0 ? matching : candidates));
}

/** Throws a `TypeError` for a time zone the runtime doesn't know. */
export function assertTimeZone(timeZone: string): void {
  getFormatter(timeZone);
}

/**
 * Reads a date (`'2024-01-31'`, its midnight) or a date-time without an offset (`'2024-01-31 10:00'`) as
 * the wall clock of `timeZone`, and returns that instant. A date-time with an offset (`Z`, `+02:00`) is an
 * instant already and is returned as is. Any other string throws a `TypeError` naming `name`.
 */
export function readInTimeZone(value: string, timeZone: string, name: string): Date | string {
  if (DATE_TIME_WITH_OFFSET.test(value)) {
    return value;
  }

  const match = LOCAL_DATE_TIME.exec(value);

  if (match === null) {
    throw new TypeError(
      `Invalid ${name} "${value}": with timeZone, expected a Date, a date (YYYY-MM-DD) or a date-time ` +
        '(YYYY-MM-DD HH:mm[:ss[.sss]]) with or without an offset'
    );
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = ''] = match;
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  // a Date keeps milliseconds: finer fractions are dropped
  wallClock.setUTCHours(Number(hour), Number(minute), Number(second), Number(fraction.padEnd(3, '0').slice(0, 3)));

  const roundTrip = wallClock.toISOString();
  const expected = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;

  if (isNaN(wallClock.getTime()) || roundTrip.slice(0, 19) !== expected) {
    throw new TypeError(`Invalid ${name} "${value}": not a calendar date and time`);
  }

  return new Date(wallClockToInstant(wallClock.getTime(), timeZone));
}
