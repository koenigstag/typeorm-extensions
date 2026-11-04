import * as lib from 'typeorm-extensions/index';
import { tableHelper as deepTableHelper } from 'typeorm-extensions/utils/table.utils';

describe('package root exports', () => {
  it('SHOULD export tableHelper from the package root', () => {
    expect(typeof lib.tableHelper).toBe('function');
    expect(lib.tableHelper).toBe(deepTableHelper);
  });

  it('SHOULD build the same SQL via the root export', () => {
    expect(lib.tableHelper('user').column('id')).toBe('"user"."id"');
  });

  it('SHOULD export InvalidCursorError, but not internal helpers', () => {
    expect(new lib.InvalidCursorError('x')).toBeInstanceOf(TypeError);
    expect(new lib.InvalidCursorError('x').name).toBe('InvalidCursorError');

    for (const name of ['attachPeriodFilter', 'attachOrderByArrayPosition', 'encodeCursor', 'andWhereNarrowing']) {
      expect(lib).not.toHaveProperty(name);
    }
  });
});
