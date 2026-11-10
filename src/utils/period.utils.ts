import type { WhereExpressionBuilder } from 'typeorm';
import type { PeriodFilter } from '../types/interfaces/period.interface';
import type { ApplyPeriodOptions } from '../types/extensions/period.types';
import { createUniqueParameterName } from './sql.utils';
import { andWhereNarrowing } from './where.utils';
import { assertTimeZone, readInTimeZone } from './time-zone.utils';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `'2024-01-31'` as a UTC midnight Date, or a `TypeError` if it is not a calendar date (`'2024-02-30'`). */
function parseDateOnly(value: string, name: string): Date {
  const day = new Date(`${value}T00:00:00.000Z`);

  if (isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`Invalid ${name} "${value}": not a calendar date`);
  }

  return day;
}

/** A usable boundary, `undefined` for a missing one (`undefined`, `null`, `''`). */
function normalizeBoundary(value: unknown, name: string): Date | string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN((value as Date).getTime())) {
      throw new TypeError(`Invalid ${name}: invalid Date`);
    }

    return value as Date;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`Invalid ${name}: expected a Date or a string, got ${typeof value}`);
  }

  if (DATE_ONLY.test(value)) {
    parseDateOnly(value, name);
  }

  return value;
}

/** The day after a date-only string, or `undefined` past year 9999. */
function getNextDay(value: string, name: string): string | undefined {
  const day = parseDateOnly(value, name);
  day.setUTCDate(day.getUTCDate() + 1);

  const next = day.toISOString().slice(0, 10);

  return DATE_ONLY.test(next) ? next : undefined;
}

/**
 * The comparison for one end of the period. A date-only string stands for the whole day,
 * so excluding the start or including the end moves the bound to the next day:
 * `> '2024-01-01'` would still match timestamps later on January 1st.
 */
function getBoundCondition(
  boundary: Date | string,
  name: 'periodFrom' | 'periodTo',
  include: boolean
): { operator: '>=' | '>' | '<=' | '<'; value: Date | string } {
  const isFrom = name === 'periodFrom';
  const nextDay =
    typeof boundary === 'string' && DATE_ONLY.test(boundary) && include !== isFrom
      ? getNextDay(boundary, name)
      : undefined;

  if (nextDay !== undefined) {
    // excluded start day: `>= next day`; included end day: `< next day`
    return { operator: isFrom ? '>=' : '<', value: nextDay };
  }

  if (isFrom) {
    return { operator: include ? '>=' : '>', value: boundary };
  }

  return { operator: include ? '<=' : '<', value: boundary };
}

/**
 * Adds `column >= :periodFrom` and `column <= :periodTo` conditions (or their exclusive versions) with
 * AND, so the filter narrows whatever WHERE conditions the query already has, OR ones included:
 * `(a OR b) AND column >= …`. `column` is already quoted.
 */
export function attachPeriodFilter<QB extends WhereExpressionBuilder>(
  builder: QB,
  column: string,
  periodFilter: PeriodFilter | null | undefined,
  options?: ApplyPeriodOptions
): QB {
  const { includeFrom = true, includeTo = true, timeZone } = options ?? {};

  if (timeZone) {
    assertTimeZone(timeZone);
  }

  const bounds = [
    { name: 'periodFrom' as const, include: includeFrom },
    { name: 'periodTo' as const, include: includeTo },
  ];

  for (const { name, include } of bounds) {
    const boundary = normalizeBoundary(periodFilter?.[name], name);

    if (boundary === undefined) {
      continue;
    }

    const { operator, value } = getBoundCondition(boundary, name, include);
    const paramName = createUniqueParameterName(name);
    const bound = timeZone && typeof value === 'string' ? readInTimeZone(value, timeZone, name) : value;

    andWhereNarrowing(builder, `${column} ${operator} :${paramName}`, { [paramName]: bound });
  }

  return builder;
}
