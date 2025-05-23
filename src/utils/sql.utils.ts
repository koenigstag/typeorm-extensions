import { DatabaseType } from 'typeorm';
import { randomString } from './common.utils';

export const wrapWithDoubleQoutes = (str: string) =>
  str.includes('"') ? str : `"${str}"`;

export const wrapWithBackQoutes = (str: string) =>
  str.includes('`') ? str : '`' + str + '`';

export const stringToSQLIdentifier = (
  str: string,
  driver?: DatabaseType
): string =>
  str.includes('.')
    ? str
        .split('.')
        .map((val) =>
          driver?.includes('mysql')
            ? wrapWithBackQoutes(val)
            : wrapWithDoubleQoutes(val)
        )
        .join('.')
    : wrapWithDoubleQoutes(str);

export const stringToSQLValue = (str: string): string => `'${str}'`;

export const createUniqueParameterName = (prefix?: string): string => {
  const uniqueCode = randomString(5);

  return `${prefix || 'param'}_${uniqueCode}`;
};
