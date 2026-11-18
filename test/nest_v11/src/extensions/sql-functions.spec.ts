import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { Sql } from 'typeorm-extensions/utils/sql-functions.utils';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

const u = tableHelper<UserEntity>('user');

describe('Sql functions', () => {
  it('SHOULD write each function as is, around the expressions it is given', () => {
    expect(Sql.count()).toBe('COUNT(*)');
    expect(Sql.count(u.email, { distinct: true })).toBe('COUNT(DISTINCT "user"."email")');
    expect(Sql.count(undefined, { filter: `${u.id} > 2` })).toBe('COUNT(CASE WHEN "user"."id" > 2 THEN 1 END)');
    expect(Sql.count(undefined, { filter: `${u.id} > 2`, syntax: 'filter' })).toBe('COUNT(*) FILTER (WHERE "user"."id" > 2)');
    expect(Sql.sum(u.id, { filter: `${u.id} > 2` })).toBe('SUM(CASE WHEN "user"."id" > 2 THEN "user"."id" END)');
    expect(Sql.min(u.createdAt)).toBe('MIN("user"."createdAt")');
    expect(Sql.max(u.createdAt, { filter: u.isNotNull('email'), syntax: 'filter' })).toBe(
      'MAX("user"."createdAt") FILTER (WHERE "user"."email" IS NOT NULL)'
    );
    expect(Sql.avg(u.id)).toBe('AVG("user"."id")');
    expect(Sql.boolOr(`${u.id} > 2`)).toBe('BOOL_OR("user"."id" > 2)');
    expect(Sql.boolAnd(u.isNotNull('email'))).toBe('BOOL_AND("user"."email" IS NOT NULL)');
    expect(Sql.coalesce(Sql.max(u.id), '0')).toBe('COALESCE(MAX("user"."id"), 0)');
    expect(Sql.nullif(u.lastName, "''")).toBe(`NULLIF("user"."lastName", '')`);
    expect(Sql.greatest(u.createdAt, u.updatedAt)).toBe('GREATEST("user"."createdAt", "user"."updatedAt")');
    expect(Sql.least(u.createdAt, 'NOW()')).toBe('LEAST("user"."createdAt", NOW())');
    expect(Sql.lower(u.email)).toBe('LOWER("user"."email")');
    expect(Sql.upper(u.email)).toBe('UPPER("user"."email")');
    expect(Sql.cast(u.id, 'numeric(10, 2)')).toBe('CAST("user"."id" AS numeric(10, 2))');
    expect(Sql.cast(u.id, 'uuid[]')).toBe('CAST("user"."id" AS uuid[])');
    expect(Sql.distinctOn(u.lastName, u.id)).toBe('DISTINCT ON ("user"."lastName", "user"."id")');
  });

  it('SHOULD refuse a missing expression, a type that is not a type name and an unknown syntax', () => {
    expect(() => Sql.max(undefined as never)).toThrow(/Sql\.max\(\): the argument is an SQL expression/);
    expect(() => Sql.coalesce(u.id, '  ')).toThrow(/Sql\.coalesce\(\): the argument 2 is an SQL expression/);
    expect(() => Sql.coalesce(...([u.id] as never as [string, string]))).toThrow(/at least 2 expressions/);
    expect(() => Sql.cast(u.id, 'text) OR (1=1')).toThrow(TypeError);
    expect(() => Sql.count(undefined, { distinct: true })).toThrow(/needs an expression/);
    expect(() => Sql.min(u.id, { filter: 'TRUE', syntax: 'where' as never })).toThrow(/Sql\.min\(\): syntax is 'case' or 'filter'/);
  });
});

setupTest('Sql functions in queries', undefined, (context) => {
  // users 1–4: Alice, Bob, Carol, Dave; Bob and Dave have metadata
  const seed = async () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave'];

    await context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index],
          metadata: (index % 2 === 1 ? { score: index } : null) as never,
        }),
      })
    );
  };
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  it('SHOULD give what the database gives for the aggregates, NULL for no rows', async () => {
    await seed();

    const row = await users()
      .select(Sql.count(), 'all')
      .addSelect(Sql.count(u.metadata), 'withMetadata')
      .addSelect(Sql.count(u.firstName, { distinct: true }), 'names')
      .addSelect(Sql.count(undefined, { filter: `${u.id} > 2` }), 'late')
      .addSelect(Sql.count(undefined, { filter: `${u.id} > 2`, syntax: 'filter' }), 'lateFilter')
      .addSelect(Sql.sum(u.id), 'sum')
      .addSelect(Sql.sum(u.id, { filter: `${u.id} > 2` }), 'lateSum')
      .addSelect(Sql.min(u.id), 'min')
      .addSelect(Sql.max(u.id), 'max')
      .addSelect(Sql.avg(u.id), 'avg')
      .getRawOne<Record<string, number | string>>();

    expect(Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key, Number(value)]))).toEqual({
      all: 4,
      withMetadata: 2,
      names: 4,
      late: 2,
      lateFilter: 2,
      sum: 10,
      lateSum: 7,
      min: 1,
      max: 4,
      avg: 2.5,
    });

    const empty = await users()
      .select(Sql.sum(u.id), 'sum')
      .addSelect(Sql.max(u.id), 'max')
      .addSelect(Sql.coalesce(Sql.sum(u.id), '0'), 'sumOrZero')
      .where(`${u.id} < 0`)
      .getRawOne<Record<string, number | null>>();

    expect(empty).toEqual({ sum: null, max: null, sumOrZero: 0 });
  });

  it('SHOULD apply the scalar functions per row', async () => {
    await seed();

    const rows = await users()
      .select(u.id, 'id')
      .addSelect(Sql.coalesce(Sql.cast(u.metadata, 'text'), "'none'"), 'metadata')
      .addSelect(Sql.nullif(u.firstName, "'Bob'"), 'notBob')
      .addSelect(Sql.lower(u.firstName), 'lower')
      .addSelect(Sql.upper(u.firstName), 'upper')
      .addSelect(Sql.cast(u.id, 'text'), 'idText')
      .orderBy(u.id)
      .getRawMany<{ id: number; metadata: string; notBob: string | null; lower: string; upper: string; idText: string }>();

    expect(rows.map((row) => [row.metadata === 'none', row.notBob, row.lower, row.upper, row.idText])).toEqual([
      [true, 'Alice', 'alice', 'ALICE', '1'],
      [false, null, 'bob', 'BOB', '2'],
      [true, 'Carol', 'carol', 'CAROL', '3'],
      [false, 'Dave', 'dave', 'DAVE', '4'],
    ]);
  });
});
