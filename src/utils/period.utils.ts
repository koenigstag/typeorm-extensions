import type { WhereExpressionBuilder } from 'typeorm';
import type { PeriodFilter } from '../types/interfaces/period.interface';
import type { ApplyPeriodOptions } from '../types/extensions/period.types';
import { createUniqueParameterName } from './sql.utils';

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
function getNextDay(value: string): string | undefined {
  const day = parseDateOnly(value, 'periodTo');
  day.setUTCDate(day.getUTCDate() + 1);

  const next = day.toISOString().slice(0, 10);

  return DATE_ONLY.test(next) ? next : undefined;
}

/**
 * Adds `column >= :from` and `column <= :to` (or `column < :to`) conditions with AND,
 * so the filter narrows whatever WHERE conditions the query already has.
 * `column` is already quoted.
 */
export function attachPeriodFilter<QB extends WhereExpressionBuilder>(
  builder: QB,
  column: string,
  periodFilter: PeriodFilter | null | undefined,
  options?: ApplyPeriodOptions
): QB {
  const { periodToExclusive = false } = options ?? {};

  const periodFrom = normalizeBoundary(periodFilter?.periodFrom, 'periodFrom');
  const periodTo = normalizeBoundary(periodFilter?.periodTo, 'periodTo');

  if (periodFrom !== undefined) {
    const paramName = createUniqueParameterName('periodFrom');
    builder.andWhere(`${column} >= :${paramName}`, { [paramName]: periodFrom });
  }

  if (periodTo !== undefined) {
    const paramName = createUniqueParameterName('periodTo');

    // '2024-01-31' means the whole day: `< '2024-02-01'` also covers timestamps within it
    const nextDay =
      !periodToExclusive && typeof periodTo === 'string' && DATE_ONLY.test(periodTo)
        ? getNextDay(periodTo)
        : undefined;

    if (nextDay !== undefined) {
      builder.andWhere(`${column} < :${paramName}`, { [paramName]: nextDay });
    } else {
      builder.andWhere(`${column} ${periodToExclusive ? '<' : '<='} :${paramName}`, {
        [paramName]: periodTo,
      });
    }
  }

  return builder;
}
