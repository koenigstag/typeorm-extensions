import type { DatabaseType } from 'typeorm';
import { isMysqlLikeDriver, isPostgresLikeDriver, isSqliteLikeDriver } from './sql.utils';
import { isDate } from './common.utils';

/** A cursor that can't be decoded or doesn't belong to the query's order (e.g. tampered with). */
export class InvalidCursorError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

/** A key value in a cursor: as read from the database, or a JS Date tagged as `{ $date }`. */
export type CursorValue = string | number | boolean;
type EncodedCursorValue = CursorValue | { $date: string };

type CursorPayload = {
  /** property paths of the keys, to reject a cursor made for another order */
  k: string[];
  /** key values of the last row */
  v: EncodedCursorValue[];
};


const toCursorValue = (value: unknown): EncodedCursorValue => {
  if (isDate(value)) {
    return { $date: value.toISOString() };
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value as CursorValue;
};

// base64url of UTF-8 text, with the globals of Node 16+ and browsers (no Buffer, no @types/node)
const toBase64Url = (text: string): string => {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => (binary += String.fromCharCode(byte)));

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): string => {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new InvalidCursorError('Invalid cursor: not base64url');
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));

  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0))
  );
};

/** base64url-encoded JSON of the key fields and the key values of the last row. */
export function encodeCursor(fields: string[], values: unknown[]): string {
  const payload: CursorPayload = { k: fields, v: values.map(toCursorValue) };

  return toBase64Url(JSON.stringify(payload));
}

const isCursorValue = (value: unknown): value is EncodedCursorValue =>
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  typeof value === 'boolean' ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { $date?: unknown }).$date === 'string');

/** Key values of a cursor made for `fields`; throws `InvalidCursorError` otherwise. */
export function decodeCursor(cursor: string, fields: string[]): Array<CursorValue | Date> {
  let payload: CursorPayload;

  try {
    payload = JSON.parse(fromBase64Url(cursor));
  } catch {
    throw new InvalidCursorError('Invalid cursor: it could not be decoded');
  }

  if (
    !payload ||
    !Array.isArray(payload.k) ||
    !Array.isArray(payload.v) ||
    payload.k.length !== fields.length ||
    payload.v.length !== fields.length ||
    payload.k.some((field, i) => field !== fields[i]) ||
    !payload.v.every(isCursorValue)
  ) {
    throw new InvalidCursorError(`Invalid cursor: it was not made for the order (${fields.join(', ')})`);
  }

  return payload.v.map((value) => {
    if (typeof value !== 'object') {
      return value;
    }

    const date = new Date(value.$date);

    if (isNaN(date.getTime())) {
      throw new InvalidCursorError('Invalid cursor: invalid date');
    }

    return date;
  });
}

/** Databases that compare row values: `(a, b) < (1, 2)`. */
export const supportsRowValueComparison = (driver?: DatabaseType): boolean =>
  isPostgresLikeDriver(driver) ||
  isMysqlLikeDriver(driver) ||
  isSqliteLikeDriver(driver);

/**
 * Type to read a date / time column as text with, so the cursor keeps the database's own precision
 * (PostgreSQL timestamps have microseconds, a JS Date only milliseconds). `undefined` when unknown.
 */
export const getTextCastType = (driver?: DatabaseType): string | undefined => {
  if (isPostgresLikeDriver(driver) || isSqliteLikeDriver(driver)) {
    return 'text';
  }

  if (isMysqlLikeDriver(driver)) {
    return 'char';
  }

  if (driver === 'mssql') {
    return 'nvarchar(max)';
  }

  return undefined;
};

export type KeysetColumn = {
  /** quoted column, e.g. `"user"."createdAt"` */
  column: string;
  direction: 'ASC' | 'DESC';
  /** parameter name holding the cursor value of this column */
  paramName: string;
};

/**
 * WHERE condition for the rows after the cursor:
 * - same direction everywhere, on databases with row values: `(a, b) > (:a, :b)`
 * - otherwise: `a >= :a AND (a > :a OR (a = :a AND b < :b))`, where the leading bound lets an index on `a` be used
 */
export function buildKeysetCondition(keys: KeysetColumn[], useRowValues: boolean): string {
  const operator = (key: KeysetColumn) => (key.direction === 'ASC' ? '>' : '<');

  if (keys.length === 1) {
    const [key] = keys;
    return `${key.column} ${operator(key)} :${key.paramName}`;
  }

  if (useRowValues && keys.every((key) => key.direction === keys[0].direction)) {
    const columns = keys.map((key) => key.column).join(', ');
    const params = keys.map((key) => `:${key.paramName}`).join(', ');

    return `(${columns}) ${operator(keys[0])} (${params})`;
  }

  const expand = (index: number): string => {
    const key = keys[index];
    const after = `${key.column} ${operator(key)} :${key.paramName}`;

    if (index === keys.length - 1) {
      return after;
    }

    return `(${after} OR (${key.column} = :${key.paramName} AND ${expand(index + 1)}))`;
  };

  const [first] = keys;

  return `(${first.column} ${operator(first)}= :${first.paramName} AND ${expand(0)})`;
}
