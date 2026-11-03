import { hasParamPlaceholder } from 'typeorm-extensions/utils/where.utils';

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
  });
});
