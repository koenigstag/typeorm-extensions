// Only the side-effect-free entry point is imported in this file (jest isolates modules per file)
import { SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { escapeLikePattern, tableHelper } from 'typeorm-extensions/helpers';

describe('typeorm-extensions/helpers', () => {
  it('SHOULD export tableHelper', () => {
    expect(tableHelper<{ id: number }>('user').column('id')).toBe('"user"."id"');
  });

  it('SHOULD export escapeLikePattern', () => {
    expect(escapeLikePattern('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('SHOULD not patch query builders', () => {
    const select = SelectQueryBuilder.prototype as unknown as Record<string, unknown>;
    const update = UpdateQueryBuilder.prototype as unknown as Record<string, unknown>;

    for (const method of [
      'getManyWithTotals',
      'applyOrder',
      'applyPagination',
      'applyPaginationFilter',
      'whereIsIn',
      'whereIsAny',
      'whereTyped',
      'selectTyped',
      'whereILikeTyped',
      'whereSearchTyped',
      'whereLowerEqualsTyped',
      'whereSimilarTyped',
    ]) {
      expect(select[method]).toBeUndefined();
    }
    expect(update.whereTyped).toBeUndefined();
  });
});
