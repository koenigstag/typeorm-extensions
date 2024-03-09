export const wrapWithDblQoutes = (str: string) =>
  str.includes('"') ? str : `"${str}"`;

export const stringToSQLIdentifier = (str: string): string =>
  str.includes('.')
    ? str.split('.').map(wrapWithDblQoutes).join('.')
    : wrapWithDblQoutes(str);

export const stringToSQLValue = (str: string): string => `'${str}'`;
