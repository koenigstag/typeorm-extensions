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
  value?: unknown,
  options?: { addValue?: boolean }
): QB {
  const { addValue = true } = options || {};

  if (method && typeof field === 'string' && typeof conditions === 'string') {
    field = stringToSQLIdentifier(field);

    if (addValue) {
      // is object (not primitive, null or array)
      const firstValue =
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? Object.values(value)[0]
          : value;

      // 0, false, '' are valid values like any other
      // null is a valid value, but undefined and NaN are not
      const valueIsValid =
        firstValue !== undefined &&
        (typeof firstValue === 'number' ? !isNaN(firstValue) : true);

      const paramName = valueIsValid
        ? createUniqueParameterName(method)
        : undefined;

      const params =
        paramName && valueIsValid ? { [paramName]: firstValue } : undefined;

      const valuePlaceholder = getValuePlaceholder(firstValue, paramName);

      return builder[method](
        `${field} ${conditions} ${valuePlaceholder}`,
        params
      );
    } else {
      return builder[method](`${field} ${conditions}`, value as ObjectLiteral);
    }
  }

  return builder;
}
