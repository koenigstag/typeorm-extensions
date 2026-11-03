import type { ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
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

/**
 * Checks whether `conditions` already references a key of `params` as a TypeORM
 * named parameter (`:key` or `:...key`). Matches parameters the same way TypeORM does,
 * so `::type` casts and colons inside literals don't count unless they name a `params` key.
 */
export function hasParamPlaceholder(conditions: string, params?: unknown): boolean {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
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
      // pick first value from params object or pass as is
      const firstValue =
        params !== null && typeof params === 'object' && !Array.isArray(params)
          ? Object.values(params)[0]
          : params;

      // 0, false, '' are valid values like any other
      // null, undefined and NaN are equal to NULL
      const valueIsValid =
        firstValue !== undefined &&
        (typeof firstValue === 'number' ? !isNaN(firstValue) : true);

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
