import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { inspect } from 'util';
import { UserEntity } from '../models';
import { setupTest, createFakeUsers } from '../test-utils';
import { sqliteDrivers } from '../constants/database';

describe('tableHelper', () => {
  describe('column', () => {
    it('SHOULD return quoted alias.column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.column('id')).toBe('"user"."id"');
    });

    it('SHOULD return quoted column without alias', () => {
      const table = tableHelper<UserEntity>();

      expect(table.column('email')).toBe('"email"');
    });

    it('SHOULD override alias when passed as argument', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.column('id', 'u')).toBe('"u"."id"');
    });

    it('SHOULD return unquoted when useQuotes is false', () => {
      const table = tableHelper<UserEntity>('user', { useQuotes: false });

      expect(table.column('id')).toBe('user.id');
    });

    it('SHOULD return unquoted column without alias when useQuotes is false', () => {
      const table = tableHelper<UserEntity>(undefined, { useQuotes: false });

      expect(table.column('firstName')).toBe('firstName');
    });
  });

  describe('where', () => {
    it('SHOULD return column with expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.where('id', '= :id')).toBe('"user"."id" = :id');
    });

    it('SHOULD return column only when no expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.where('id')).toBe('"user"."id"');
    });
  });

  describe('join', () => {
    it('SHOULD return alias.relation', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.join('images')).toBe('user.images');
      expect(table.join('images', 'u')).toBe('u.images');
      expect(() => tableHelper<UserEntity>().join('images')).toThrow(/needs an alias/);
    });
  });

  describe('joinOn', () => {
    it('SHOULD return column with expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.joinOn('id', '= image.userId')).toBe('"user"."id" = image.userId');
    });
  });

  describe('isNull', () => {
    it('SHOULD return column IS NULL', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.isNull('email')).toBe('"user"."email" IS NULL');
    });
  });

  describe('isNotNull', () => {
    it('SHOULD return column IS NOT NULL', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.isNotNull('email')).toBe('"user"."email" IS NOT NULL');
    });
  });

  describe('count', () => {
    it('SHOULD return COUNT with specific column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.count('id')).toBe('CAST(COUNT("user"."id") AS integer)');
    });

    it('SHOULD return COUNT(*) when no column, with or without an alias', () => {
      const table = tableHelper<UserEntity>('user');

      // not COUNT("user".*), which only PostgreSQL accepts
      expect(table.count()).toBe('CAST(COUNT(*) AS integer)');
    });

    it('SHOULD return COUNT(*) when no column and no alias', () => {
      const table = tableHelper<UserEntity>();

      expect(table.count()).toBe('CAST(COUNT(*) AS integer)');
    });

    it('SHOULD return COUNT(*) when useQuotes is false too', () => {
      const table = tableHelper<UserEntity>('user', { useQuotes: false });

      expect(table.count()).toBe('CAST(COUNT(*) AS integer)');
    });

    it('SHOULD count distinct values of a column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.count('email', { distinct: true })).toBe('CAST(COUNT(DISTINCT "user"."email") AS integer)');
      expect(() => table.count(undefined, { distinct: true })).toThrow(/needs a column/);
    });

    it('SHOULD count rows matching a condition with CASE by default', () => {
      const table = tableHelper<UserEntity>('user');
      const filter = table.where('firstName', "= 'Ann'");

      expect(table.count(undefined, { filter })).toBe(
        `CAST(COUNT(CASE WHEN "user"."firstName" = 'Ann' THEN 1 END) AS integer)`
      );
      expect(table.count('email', { filter, distinct: true })).toBe(
        `CAST(COUNT(DISTINCT CASE WHEN "user"."firstName" = 'Ann' THEN "user"."email" END) AS integer)`
      );
    });

    it('SHOULD count rows matching a condition with FILTER on request', () => {
      const table = tableHelper<UserEntity>('user');
      const filter = table.where('firstName', "= 'Ann'");

      expect(table.count(undefined, { filter, syntax: 'filter' })).toBe(
        `CAST(COUNT(*) FILTER (WHERE "user"."firstName" = 'Ann') AS integer)`
      );
      expect(table.count('email', { filter, distinct: true, syntax: 'filter' })).toBe(
        `CAST(COUNT(DISTINCT "user"."email") FILTER (WHERE "user"."firstName" = 'Ann') AS integer)`
      );
    });

    it('SHOULD reject the old string argument and unknown syntaxes', () => {
      const table = tableHelper<UserEntity>('user');

      expect(() => table.count('id', 'DISTINCT' as never)).toThrow(/options object/);
      expect(() => table.count('id', { filter: 'x', syntax: 'where' as never })).toThrow(/'case' or 'filter'/);
    });
  });

  describe('cast', () => {
    it('SHOULD wrap expression in CAST', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.cast('"user"."id"', 'text')).toBe('CAST("user"."id" AS text)');
    });
  });

  describe('jsonColumn', () => {
    it('SHOULD return column with ->> operator', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->>', 'nested')).toBe('"user"."firstName" ->> \'nested\'');
    });

    it('SHOULD use -> json operator', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->', 'nested')).toBe('"user"."firstName" -> \'nested\'');
    });

    it('SHOULD support nested path with rest params', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->>', 'billing', 'amount')).toBe(
        '"user"."firstName" -> \'billing\' ->> \'amount\''
      );
    });

    it('SHOULD support deeply nested path (3+ levels)', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->>', 'a', 'b', 'c')).toBe(
        '"user"."firstName" -> \'a\' -> \'b\' ->> \'c\''
      );
    });

    it('SHOULD use -> for all segments when jsonOperator is ->', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->', 'a', 'b')).toBe(
        '"user"."firstName" -> \'a\' -> \'b\''
      );
    });

    it('SHOULD escape single quotes in keys', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonColumn('firstName', '->>', "o'brien")).toBe(
        '"user"."firstName" ->> \'o\'\'brien\''
      );
    });

    it('SHOULD keep a quote-injection attempt inside the key literal', () => {
      const table = tableHelper<UserEntity>('user');

      expect(
        table.jsonColumn('firstName', '->>', "x' OR '1'='1", 'y'),
      ).toBe(
        '"user"."firstName" -> \'x\'\' OR \'\'1\'\'=\'\'1\' ->> \'y\''
      );
    });
  });

  describe('jsonPath', () => {
    it('SHOULD return only operator fragment', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonPath('firstName', '->>', 'role')).toBe("->> 'role'");
    });

    it('SHOULD return nested operators without column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonPath('firstName', '->>', 'billing', 'amount')).toBe(
        "-> 'billing' ->> 'amount'"
      );
    });

    it('SHOULD support deeply nested path', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonPath('firstName', '->>', 'a', 'b', 'c')).toBe(
        "-> 'a' -> 'b' ->> 'c'"
      );
    });

    it('SHOULD escape single quotes in keys', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonPath('firstName', '->>', "it's", 'ok')).toBe(
        "-> 'it''s' ->> 'ok'"
      );
    });
  });

  describe('column accessor', () => {
    type Row = { id: number; userId: string; 'first-name': string; alias: string; count: number };

    it('SHOULD give what column() gives for a column read as a property', () => {
      const table = tableHelper<UserEntity>('user');
      const row = tableHelper<Row>('row');

      expect(table.firstName).toBe(table.column('firstName'));
      expect(table.firstName).toBe('"user"."firstName"');
      expect(row.userId).toBe('"row"."userId"');
      expect(row['first-name']).toBe(row.column('first-name'));
      expect(row['first-name']).toBe('"row"."first-name"');
    });

    it('SHOULD follow the alias and the options, as column() does', () => {
      expect(tableHelper<Row>().userId).toBe('"userId"');
      expect(tableHelper<Row>('row', { useQuotes: false }).userId).toBe('row.userId');
      expect(tableHelper<Row>('row', { driver: 'mysql' }).userId).toBe('`row`.`userId`');
      expect(tableHelper<Row>('my.row').userId).toBe(tableHelper<Row>('my.row').column('userId'));
    });

    it('SHOULD give the members of the helper, not columns of the same name', () => {
      const row = tableHelper<Row>('row');

      expect(row.alias).toBe('row');
      expect(row.count('id')).toBe('CAST(COUNT("row"."id") AS integer)');
      expect(row.column('count')).toBe('"row"."count"');

      for (const member of Object.keys(row)) {
        expect(row[member as keyof typeof row]).not.toBe(row.column(member as keyof Row));
      }
    });

    it.each([
      'then',
      'toJSON',
      'toString',
      'valueOf',
      'constructor',
      'inspect',
      'asymmetricMatch',
      '$$typeof',
      'nodeType',
      '__proto__',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ])('SHOULD not read %s as a column', (key) => {
      const table = tableHelper<UserEntity>('user');

      expect((table as Record<string, unknown>)[key]).toBe(({} as Record<string, unknown>)[key]);
    });

    it('SHOULD not read symbols as columns', () => {
      const table = tableHelper<UserEntity>('user') as unknown as Record<symbol, unknown>;

      expect(table[Symbol.iterator]).toBeUndefined();
      expect(table[Symbol.toPrimitive]).toBeUndefined();
      expect(table[Symbol.toStringTag]).toBeUndefined();
      expect(table[Symbol.for('nodejs.util.inspect.custom')]).toBeUndefined();
    });

    it('SHOULD log, serialize, await and compare like a plain object', async () => {
      const table = tableHelper<UserEntity>('user');

      expect(JSON.stringify(table)).toBe('{"alias":"user"}');
      expect(String(table)).toBe('[object Object]');
      expect(`${table}`).toBe('[object Object]');
      expect(inspect(table)).toContain("alias: 'user'");
      expect(await Promise.resolve(table)).toBe(table);
      expect(table).toEqual(expect.objectContaining({ alias: 'user' }));
      expect(Object.keys(table)).toContain('column');
      expect('firstName' in table).toBe(false);
    });
  });
});

setupTest('tableHelper.jsonColumn (database)', undefined, (context) => {
  // `metadata` is a `simple-json` (text) column: SQLite's `->>` works on JSON text,
  // PostgreSQL's needs a json/jsonb column
  if (!sqliteDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only runs on sqlite (JSON operators on a text column)', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  // Loosely typed JSON column so arbitrary keys are allowed
  const t = tableHelper<{ metadata: Record<string, unknown> }>('user');

  it('SHOULD match a JSON key that contains a single quote', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    let fakeUsers = await createFakeUsers({ count: 3 });
    fakeUsers[0].metadata = {
      ...fakeUsers[0].metadata,
      "o'brien": 'yes',
    } as UserEntity['metadata'];
    fakeUsers = await usersRepository.save(fakeUsers);

    const result = await usersRepository
      .createQueryBuilder('user')
      .where(`${t.jsonColumn('metadata', '->>', "o'brien")} = :value`, {
        value: 'yes',
      })
      .getMany();

    expect(result.map((user) => user.id)).toEqual([fakeUsers[0].id]);
  });

  it('SHOULD not let a key break out of its literal and widen the WHERE', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    await usersRepository.save(await createFakeUsers({ count: 3 }));

    const result = await usersRepository
      .createQueryBuilder('user')
      .where(
        `${t.jsonColumn('metadata', '->>', "x' OR 1=1 OR '")} = :value`,
        { value: 'yes' },
      )
      .getMany();

    expect(result).toHaveLength(0);
  });
});
