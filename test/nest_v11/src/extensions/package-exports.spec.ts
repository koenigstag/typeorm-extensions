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
});
