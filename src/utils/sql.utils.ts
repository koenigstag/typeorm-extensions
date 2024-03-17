import { DatabaseType } from 'typeorm';

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
