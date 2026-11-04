// Only the side-effect-free entry point is imported in this file (jest isolates modules per file)
import { SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/helpers';

describe('typeorm-extensions/helpers', () => {
  it('SHOULD export tableHelper', () => {
    expect(tableHelper<{ id: number }>('user').column('id')).toBe('"user"."id"');
  });

  it('SHOULD not patch query builders', () => {
    const select = SelectQueryBuilder.prototype as unknown as Record<string, unknown>;
    const update = UpdateQueryBuilder.prototype as unknown as Record<string, unknown>;

    for (const method of [
      'getManyWithTotals',
      'applyOrder',
      'applyPaginationFilter',
      'whereIsIn',
      'whereIsAny',
      'whereTyped',
      'selectTyped',
    ]) {
      expect(select[method]).toBeUndefined();
    }
    expect(update.whereTyped).toBeUndefined();
  });
});
