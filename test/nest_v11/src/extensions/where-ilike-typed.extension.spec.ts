import 'typeorm-extensions/extensions/typed/typed-where/typed-where-ilike.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { DataSource } from 'typeorm';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// SQL generation only: the data sources are never connected
const builderOf = (type: 'postgres' | 'mysql' | 'better-sqlite3') =>
  new DataSource({ type, database: ':memory:' } as never)
    .createQueryBuilder()
    .select('u.id')
    .from('users', 'u');

const pg = () => builderOf('postgres');

const params = (query: { getQueryAndParameters(): [string, unknown[]] }) =>
  query.getQueryAndParameters()[1];

describe('where-ilike-typed.sql', () => {
  it('SHOULD build `column ILIKE :param` with a contains pattern by default', () => {
    const query = pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'Al');

    expect(query.getQuery()).toMatch(/WHERE "u"\."firstName" ILIKE :where_\w+$/);
    expect(params(query)).toEqual(['%Al%']);
  });

  it.each([
    ['contains', '%Al%'],
    ['prefix', 'Al%'],
    ['suffix', '%Al'],
    ['exact', 'Al'],
  ] as const)('SHOULD build the %s pattern', (match, pattern) => {
    expect(params(pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'Al', { match }))).toEqual([pattern]);
  });

  it('SHOULD escape %, _ and \\ in the value by default', () => {
    expect(params(pg().whereILikeTyped<UserEntity>((u) => u.firstName, '50%_off\\x'))).toEqual([
      '%50\\%\\_off\\\\x%',
    ]);
    expect(
      params(pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'a%b', { escape: false, match: 'exact' })),
    ).toEqual(['a%b']);
  });

  it('SHOULD trim the value', () => {
    expect(params(pg().whereILikeTyped<UserEntity>((u) => u.firstName, '  Al  '))).toEqual(['%Al%']);
  });

  it.each([[''], ['   '], [null], [undefined]])('SHOULD add no condition for %j', (value) => {
    const query = pg()
      .where('u.id = 1')
      .andWhereILikeTyped<UserEntity>((u) => u.firstName, value)
      .whereILikeTyped<UserEntity>((u) => u.lastName, value);

    // not even `where`, which would replace `u.id = 1`
    expect(query.getQuery()).toMatch(/WHERE u\.id = 1$/);
    expect(params(query)).toEqual([]);
  });

  it('SHOULD combine with AND / OR', () => {
    const query = pg()
      .whereILikeTyped<UserEntity>((u) => u.firstName, 'a')
      .orWhereILikeTyped<UserEntity>((u) => u.lastName, 'b')
      .andWhereILikeTyped<UserEntity>((u) => u.email, 'c', { match: 'suffix' });

    expect(query.getQuery()).toMatch(
      /WHERE "u"\."firstName" ILIKE :where_\w+ OR "u"\."lastName" ILIKE :orWhere_\w+ AND "u"\."email" ILIKE :andWhere_\w+$/,
    );
    expect(params(query)).toEqual(['%a%', '%b%', '%c']);
  });

  it('SHOULD wrap both sides with unaccent', () => {
    expect(
      pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'jose', { unaccent: true }).getQuery(),
    ).toMatch(/WHERE unaccent\("u"\."firstName"\) ILIKE unaccent\(:where_\w+\)$/);

    expect(
      pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'jose', { unaccent: 'public.f_unaccent' }).getQuery(),
    ).toMatch(/WHERE public\.f_unaccent\("u"\."firstName"\) ILIKE public\.f_unaccent\(:where_\w+\)$/);
  });

  it('SHOULD throw for an invalid unaccent function, match or value', () => {
    expect(() =>
      pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'a', { unaccent: 'x); DROP TABLE users; --' }),
    ).toThrow(/Invalid unaccent function/);
    expect(() =>
      pg().whereILikeTyped<UserEntity>((u) => u.firstName, 'a', { match: 'anywhere' as never }),
    ).toThrow(/Invalid match "anywhere"/);
    expect(() => pg().whereILikeTyped<UserEntity>((u) => u.firstName, 42 as never)).toThrow(
      /expects a string to search for, got number/,
    );
  });

  it('SHOULD throw WHEN the typed callback selects several columns, even for a blank value', () => {
    expect(() => pg().whereILikeTyped<UserEntity>((u) => [u.firstName, u.lastName], '')).toThrow(
      /whereILikeTyped expects the callback to select a single column, got 2/,
    );
  });

  it('SHOULD use LIKE on MySQL and LIKE … ESCAPE on SQLite', () => {
    expect(
      builderOf('mysql').whereILikeTyped<UserEntity>((u) => u.firstName, 'Al').getQuery(),
    ).toMatch(/WHERE `u`\.`firstName` LIKE :where_\w+$/);

    expect(
      builderOf('better-sqlite3').whereILikeTyped<UserEntity>((u) => u.firstName, 'Al').getQuery(),
    ).toMatch(/WHERE "u"\."firstName" LIKE :where_\w+ ESCAPE '\\'$/);
  });
});

describe('where-search-typed.sql', () => {
  it('SHOULD build one OR group with one parameter for every column', () => {
    const query = pg()
      .where('u.id > 0')
      .andWhereSearchTyped<UserEntity>(
        [(u) => u.firstName, (u) => [u.lastName, u.email], { sql: `u."firstName" || ' ' || u."lastName"` }],
        'jo',
      );

    expect(query.getQuery()).toMatch(
      new RegExp(
        String.raw`WHERE u\.id > 0 AND \("u"\."firstName" ILIKE (:andWhere_\w+) OR "u"\."lastName" ILIKE \1 ` +
          String.raw`OR "u"\."email" ILIKE \1 OR \(u\."firstName" \|\| ' ' \|\| u\."lastName"\) ILIKE \1\)$`,
      ),
    );
    // one named parameter; newer TypeORM binds it once, 0.3.12 once per use
    expect(new Set(params(query))).toEqual(new Set(['%jo%']));
  });

  it('SHOULD skip the parentheses for a single column', () => {
    expect(pg().whereSearchTyped<UserEntity>([(u) => u.firstName], 'jo').getQuery()).toMatch(
      /WHERE "u"\."firstName" ILIKE :where_\w+$/,
    );
  });

  it('SHOULD add no condition for a value shorter than minLength', () => {
    const search = (value: string | null) =>
      pg()
        .whereSearchTyped<UserEntity>([(u) => u.firstName, (u) => u.lastName], value, { minLength: 3 })
        .getQuery();

    expect(search('jo')).not.toContain('WHERE');
    expect(search('  jo  ')).not.toContain('WHERE');
    expect(search(null)).not.toContain('WHERE');
    expect(search('joh')).toContain('WHERE');
  });

  it('SHOULD pass match, escape and unaccent to every column', () => {
    const query = pg().orWhereSearchTyped<UserEntity>([(u) => u.firstName, (u) => u.lastName], 'a_b', {
      match: 'prefix',
      unaccent: true,
    });

    expect(query.getQuery()).toMatch(
      /WHERE \(unaccent\("u"\."firstName"\) ILIKE unaccent\((:orWhere_\w+)\) OR unaccent\("u"\."lastName"\) ILIKE unaccent\(\1\)\)$/,
    );
    expect(new Set(params(query))).toEqual(new Set(['a\\_b%']));
  });

  it('SHOULD throw for no columns or an invalid selector, even for a blank value', () => {
    expect(() => pg().whereSearchTyped<UserEntity>([], 'jo')).toThrow(/non-empty array of columns/);
    expect(() => pg().whereSearchTyped<UserEntity>([{ sql: ' ' }], '')).toThrow(
      /expects a typed callback or \{ sql: string \}/,
    );
    expect(() => pg().whereSearchTyped<UserEntity>([null as never], 'jo')).toThrow(TypeError);
  });
});

setupTest('where-ilike-typed', undefined, (context) => {
  const names = ['Alice', 'ALINA', 'Al_ce', '50% Bob', 'back\\slash', 'Carol'];

  const seed = async () =>
    context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index],
          lastName: index === 5 ? 'Alison' : 'Smith',
          email: `u${index}@example.com`,
        }),
      }),
    );

  const firstNames = (query: { getMany(): Promise<UserEntity[]> }) =>
    query.getMany().then((users) => users.map((user) => user.firstName));

  const usersQuery = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id', 'ASC');

  it('SHOULD match case-insensitively', async () => {
    await seed();

    expect(await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, 'ali'))).toEqual(['Alice', 'ALINA']);
    expect(
      await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, 'CAROL', { match: 'exact' })),
    ).toEqual(['Carol']);
  });

  it('SHOULD match %, _ and \\ literally', async () => {
    await seed();

    expect(await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, 'l_c'))).toEqual(['Al_ce']);
    expect(await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, '%'))).toEqual(['50% Bob']);
    expect(await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, '\\'))).toEqual(['back\\slash']);

    // without escaping `_` is any character
    expect(
      await firstNames(usersQuery().whereILikeTyped((u) => u.firstName, 'l_c', { escape: false })),
    ).toEqual(['Alice', 'Al_ce']);
  });

  it('SHOULD search several columns and expressions with one parameter', async () => {
    await seed();

    expect(
      await firstNames(
        usersQuery().whereSearchTyped([(u) => u.firstName, (u) => u.lastName], 'alis'),
      ),
    ).toEqual(['Carol']);

    expect(
      await firstNames(
        usersQuery().whereSearchTyped(
          [(u) => u.email, { sql: `"user"."firstName" || ' ' || "user"."lastName"` }],
          'alina smith',
        ),
      ),
    ).toEqual(['ALINA']);

    // shorter than minLength: no condition
    expect(
      await firstNames(usersQuery().whereSearchTyped([(u) => u.firstName], 'zz', { minLength: 3 })),
    ).toEqual(names);
  });

  it('SHOULD keep the OR group together with other conditions', async () => {
    await seed();

    const query = usersQuery()
      .whereTyped((u) => u.lastName, '=', 'Smith')
      .andWhereSearchTyped([(u) => u.firstName, (u) => u.lastName], 'alis');

    // `lastName = 'Smith' AND (firstName ILIKE … OR lastName ILIKE …)`: Carol (Alison) is out
    expect(await firstNames(query)).toEqual([]);
  });

  it('SHOULD not qualify the column on DeleteQueryBuilder', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .whereILikeTyped((u) => u.firstName, 'ali', { match: 'prefix' });

    expect(query.getQuery()).toMatch(/WHERE "firstName" (I)?LIKE :where_\w+/);

    const result = await query.execute();
    expect(result.affected).toBe(2);
    expect(await firstNames(usersQuery())).toEqual(['Al_ce', '50% Bob', 'back\\slash', 'Carol']);
  });
});

setupTest('where-ilike-typed.unaccent', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD match without accents', async () => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    await context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: 2,
        getOverrides: (index) => ({ firstName: ['José', 'Joseph'][index], email: `j${index}@example.com` }),
      }),
    );

    const search = (unaccent: boolean) =>
      context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .whereILikeTyped((u) => u.firstName, 'josé', { unaccent, match: 'prefix' })
        .orderBy('user.id', 'ASC')
        .getMany()
        .then((users) => users.map((user) => user.firstName));

    expect(await search(false)).toEqual(['José']);
    expect(await search(true)).toEqual(['José', 'Joseph']);
  });
});
