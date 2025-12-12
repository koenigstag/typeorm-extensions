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

export function attachWhere<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  conditions: string,
  params?: unknown,
  options?: { addValue?: boolean }
): QB {
  const { addValue = true } = options || {};

  if (method && typeof field === 'string' && typeof conditions === 'string') {
    field = stringToSQLIdentifier(field);

    const hasParams = typeof params !== 'undefined';
    
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
