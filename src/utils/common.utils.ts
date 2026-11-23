/** A Date, also one from another realm (a vm context, a test runner's sandbox), where `instanceof Date` is false. */
export const isDate = (value: unknown): value is Date => Object.prototype.toString.call(value) === '[object Date]';

export const isNil = (val: unknown): boolean =>
  typeof val === 'undefined' || val === null;

export function randomString(length: number = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let result = '';

  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars.charAt(index);
  }

  return result;
}
