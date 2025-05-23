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
      const firstValue = value !== null && typeof value === 'object' ? Object.values(value)[0] : value;

      const valueIsValid = firstValue !== undefined;

      const paramName = valueIsValid
        ? createUniqueParameterName(method)
        : undefined;

      const params = paramName && valueIsValid ? { [paramName]: firstValue } : undefined;

      const valuePlaceholder = getValuePlaceholder(firstValue, paramName);

      return builder[method](`${field} ${conditions} ${valuePlaceholder}`, params);
    } else {
      return builder[method](
        `${field} ${conditions}`,
        value as ObjectLiteral
      );
    }
  }

  return builder;
}
