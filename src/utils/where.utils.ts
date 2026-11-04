import type { ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { WhereMethods } from '../types/extensions/where.types';
import { createUniqueParameterName, stringToSQLIdentifier } from './sql.utils';

export function getValuePlaceholder<T>(value: T, paramName?: string): string {
  if (value === undefined || value === null || paramName === undefined) {
    return 'NULL';
  }

  if (Array.isArray(value)) {
    return `(:...${paramName})`;
  }

  return `:${paramName}`;
}

const isDate = (value: unknown): value is Date =>
  Object.prototype.toString.call(value) === '[object Date]';

/**
 * Objects that are parameter values themselves, not `{ name: value }` params objects:
 * `Date`, and binary data (`Buffer`, typed arrays, `ArrayBuffer`).
 */
const isValueObject = (value: object): boolean =>
  isDate(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer;

/**
 * Whether `params` is a `{ name: value }` params object (a plain object or a class instance such
 * as a DTO), rather than the value itself (a primitive, an array, a `Date`, a `Buffer`).
 */
export function isParamsObject(params: unknown): params is Record<string, unknown> {
  return (
    params !== null &&
    typeof params === 'object' &&
    !Array.isArray(params) &&
    !isValueObject(params)
  );
}

/**
 * Checks whether `conditions` already references a key of `params` as a TypeORM
 * named parameter (`:key` or `:...key`). Matches parameters the same way TypeORM does,
 * so `::type` casts and colons inside literals don't count unless they name a `params` key.
 */
export function hasParamPlaceholder(conditions: string, params?: unknown): boolean {
  if (!isParamsObject(params)) {
    return false;
  }

  const placeholderRegex = /:(?:\.\.\.)?([A-Za-z0-9_.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = placeholderRegex.exec(conditions)) !== null) {
    if (Object.prototype.hasOwnProperty.call(params, match[1])) {
      return true;
    }
  }

  return false;
}

export function attachWhere<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  conditions: string,
  params?: unknown,
  options?: { addValue?: boolean }
): QB {
  let { addValue } = options || {};

  if (method && typeof field === 'string' && typeof conditions === 'string') {
    field = stringToSQLIdentifier(field);

    const hasParams = typeof params !== 'undefined';
    // `addValue` defaults to `true` unless `conditions` already references one of the `params` keys
    addValue = addValue ?? !hasParamPlaceholder(conditions, params);

    if (addValue && hasParams) {
      // pick first value from params object or pass as is (a Date or a Buffer is a value too)
      const firstValue = isParamsObject(params) ? Object.values(params)[0] : params;

      // 0, false, '' are valid values like any other
      // null, undefined, NaN and invalid dates are equal to NULL
      const valueIsValid =
        firstValue !== undefined &&
        (typeof firstValue === 'number' ? !isNaN(firstValue) : true) &&
        (isDate(firstValue) ? !isNaN(firstValue.getTime()) : true);

      const paramName = valueIsValid
        ? createUniqueParameterName(method)
        : undefined;

      const queryParams =
        paramName && valueIsValid ? { [paramName]: firstValue } : undefined;

      const valuePlaceholder = getValuePlaceholder(firstValue, paramName);

      return builder[method](
        `${field} ${conditions} ${valuePlaceholder}`,
        queryParams
      );
    } else {
      return builder[method](`${field} ${conditions}`, params as ObjectLiteral);
    }
  }

  return builder;
}

/**
 * Adds an AND condition that narrows the whole WHERE clause. TypeORM's `andWhere` doesn't group
 * the conditions before it, so after `.where(a).orWhere(b)` it gives `a OR b AND c`, i.e.
 * `a OR (b AND c)`. Existing conditions with an OR are wrapped first: `(a OR b) AND c`.
 */
export function andWhereNarrowing<QB extends WhereExpressionBuilder>(
  builder: QB,
  condition: string,
  parameters?: ObjectLiteral
): QB {
  const expressionMap = (builder as unknown as QueryBuilder<ObjectLiteral>).expressionMap;
  const wheres = expressionMap?.wheres;

  if (wheres?.some((where) => where.type === 'or')) {
    // a nested clause list is rendered in parentheses
    expressionMap.wheres = [{ type: 'simple', condition: wheres }];
  }

  return builder.andWhere(condition, parameters);
}
