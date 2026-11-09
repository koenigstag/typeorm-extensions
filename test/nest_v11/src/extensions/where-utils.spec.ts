import { hasParamPlaceholder, isParamsObject } from 'typeorm-extensions/utils/where.utils';

describe('hasParamPlaceholder', () => {
  it('SHOULD detect a :key placeholder for an existing params key', () => {
    expect(hasParamPlaceholder('= :id', { id: 1 })).toBe(true);
  });

  it('SHOULD detect a :...key array placeholder', () => {
    expect(hasParamPlaceholder('IN (:...ids)', { ids: [1, 2] })).toBe(true);
  });

  it('SHOULD ignore placeholders that are not params keys', () => {
    expect(hasParamPlaceholder('= :other', { id: 1 })).toBe(false);
  });

  it('SHOULD ignore ::type casts', () => {
    expect(hasParamPlaceholder('::text =', { search: 'x' })).toBe(false);
  });

  it('SHOULD ignore colons inside literals', () => {
    expect(hasParamPlaceholder("->> 'a:b' =", { value: 'x' })).toBe(false);
  });

  it('SHOULD return false WHEN params is not a plain object', () => {
    expect(hasParamPlaceholder('= :id', 5)).toBe(false);
    expect(hasParamPlaceholder('= :id', [1])).toBe(false);
    expect(hasParamPlaceholder('= :id', null)).toBe(false);
    expect(hasParamPlaceholder('= :id', undefined)).toBe(false);
    expect(hasParamPlaceholder('= :id', new Date())).toBe(false);
    expect(hasParamPlaceholder('= :id', Buffer.from('id'))).toBe(false);
  });
});

describe('isParamsObject', () => {
  it('SHOULD accept plain objects and class instances', () => {
    class Filter {
      email = 'a@b.c';
    }

    expect(isParamsObject({ id: 1 })).toBe(true);
    expect(isParamsObject(Object.create(null))).toBe(true);
    expect(isParamsObject(new Filter())).toBe(true);
  });

  it('SHOULD reject values: primitives, arrays, dates and binary data', () => {
    for (const value of [
      undefined,
      null,
      1,
      'a',
      [1],
      new Date(),
      Buffer.from('a'),
      new Uint8Array(2),
      new ArrayBuffer(2),
    ]) {
      expect(isParamsObject(value)).toBe(false);
    }
  });
});
