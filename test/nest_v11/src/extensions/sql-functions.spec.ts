import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { Sql } from 'typeorm-extensions/utils/sql-functions.utils';
import { setupTest, createFakeUsers } from '../test-utils';
import { postgresLikeDrivers } from '../constants/database';
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

describe('Sql.for(driver)', () => {
  const pg = Sql;
  const mysql = Sql.for('mysql');
  const sqlite = Sql.for('better-sqlite3');

  it('SHOULD write the database\'s own form where they differ', () => {
    expect([pg.length(u.email), mysql.length(u.email), sqlite.length(u.email)]).toEqual([
      'LENGTH("user"."email")',
      'CHAR_LENGTH("user"."email")',
      'LENGTH("user"."email")',
    ]);
    expect([pg.concat(u.firstName, "' '"), mysql.concat(u.firstName, "' '"), sqlite.concat(u.firstName, "' '")]).toEqual([
      `CONCAT("user"."firstName", ' ')`,
      `CONCAT_WS('', "user"."firstName", ' ')`,
      `(COALESCE("user"."firstName", '') || COALESCE(' ', ''))`,
    ]);
    expect([pg.now(), mysql.now(), sqlite.now()]).toEqual(['NOW()', 'NOW()', 'CURRENT_TIMESTAMP']);
    expect([pg.interval(30, 'days'), mysql.interval(30, 'days')]).toEqual([`INTERVAL '30 days'`, 'INTERVAL 30 DAY']);
    expect([pg.ago(30, 'days'), mysql.ago(30, 'days'), sqlite.ago(30, 'days')]).toEqual([
      `(NOW() - INTERVAL '30 days')`,
      '(NOW() - INTERVAL 30 DAY)',
      `datetime('now', '-30 days')`,
    ]);
    expect([pg.addInterval(u.createdAt, 2, 'weeks'), mysql.addInterval(u.createdAt, -1, 'hours'), sqlite.addInterval(u.createdAt, 2, 'weeks')]).toEqual([
      `("user"."createdAt" + INTERVAL '2 weeks')`,
      '("user"."createdAt" - INTERVAL 1 HOUR)',
      `datetime("user"."createdAt", '+14 days')`,
    ]);
    expect([pg.extract('epoch', u.createdAt), mysql.extract('epoch', u.createdAt), sqlite.extract('epoch', u.createdAt)]).toEqual([
      'EXTRACT(EPOCH FROM "user"."createdAt")',
      'UNIX_TIMESTAMP("user"."createdAt")',
      `CAST(strftime('%s', "user"."createdAt") AS integer)`,
    ]);
    expect([pg.extract('dow', u.createdAt), mysql.extract('dow', u.createdAt), sqlite.extract('dow', u.createdAt)]).toEqual([
      'EXTRACT(DOW FROM "user"."createdAt")',
      '(DAYOFWEEK("user"."createdAt") - 1)',
      `CAST(strftime('%w', "user"."createdAt") AS integer)`,
    ]);
    expect([pg.greatest(u.id, '2'), sqlite.greatest(u.id, '2'), sqlite.least(u.id, '2')]).toEqual([
      'GREATEST("user"."id", 2)',
      'MAX("user"."id", 2)',
      'MIN("user"."id", 2)',
    ]);
    expect([pg.substring(u.email, 2, 3), sqlite.substring(u.email, 2)]).toEqual(['SUBSTRING("user"."email", 2, 3)', 'SUBSTR("user"."email", 2)']);
    expect([
      pg.stringAgg(u.firstName, ', ', { orderBy: u.id }),
      mysql.stringAgg(u.firstName, ', ', { distinct: true, orderBy: u.id }),
      sqlite.stringAgg(u.firstName, ', '),
    ]).toEqual([
      `STRING_AGG("user"."firstName", ', ' ORDER BY "user"."id")`,
      `GROUP_CONCAT(DISTINCT "user"."firstName" ORDER BY "user"."id" SEPARATOR ', ')`,
      `GROUP_CONCAT("user"."firstName", ', ')`,
    ]);
  });

  it('SHOULD write the database-independent functions the same way', () => {
    expect(sqlite.case([[`${u.id} = 1`, "'one'"]], "'other'")).toBe(`CASE WHEN "user"."id" = 1 THEN 'one' ELSE 'other' END`);
    expect(mysql.over(mysql.rowNumber(), { partitionBy: [u.lastName, u.email], orderBy: `${u.id} DESC` })).toBe(
      'ROW_NUMBER() OVER (PARTITION BY "user"."lastName", "user"."email" ORDER BY "user"."id" DESC)'
    );
    expect(pg.over(pg.lead(u.id, 2, '0'))).toBe('LEAD("user"."id", 2, 0) OVER ()');
    expect(pg.lag(u.id)).toBe('LAG("user"."id")');
    expect(pg.toChar(u.createdAt, `YYYY-MM-DD"T"`)).toBe(`TO_CHAR("user"."createdAt", 'YYYY-MM-DD"T"')`);
    expect(pg.splitPart(u.email, "@'", 2)).toBe(`SPLIT_PART("user"."email", '@''', 2)`);
    expect(pg.jsonbSet(u.metadata, ['a', "it's"], 'to_jsonb(1)', { createMissing: false })).toBe(
      `jsonb_set("user"."metadata", ARRAY['a', 'it''s'], to_jsonb(1), false)`
    );
    expect([pg.toJsonb(u.id), pg.jsonbTypeof(u.metadata), pg.jsonbArrayElements(u.metadata)]).toEqual([
      'to_jsonb("user"."id")',
      'jsonb_typeof("user"."metadata")',
      'jsonb_array_elements("user"."metadata")',
    ]);
    expect(mysql.stringAgg(u.firstName, `a\\b'`)).toBe(`GROUP_CONCAT("user"."firstName" SEPARATOR 'a\\\\b''')`);
  });

  it('SHOULD refuse a function the database has no form of, and a unit, part or amount it does not know', () => {
    expect(() => mysql.boolOr(`${u.id} > 1`)).toThrow('Sql.boolOr() has no equivalent on mysql');
    expect(() => sqlite.interval(1, 'days')).toThrow('Sql.interval() has no equivalent on better-sqlite3');
    expect(() => mysql.jsonbSet(u.metadata, ['a'], '1')).toThrow(/no equivalent on mysql/);
    expect(() => Sql.for('mssql').stringAgg(u.email, ',')).toThrow(/no equivalent on mssql/);
    expect(() => Sql.for('mssql').ago(1, 'days')).toThrow(/no equivalent on mssql/);
    expect(() => sqlite.stringAgg(u.email, ',', { distinct: true })).toThrow(/SQLite takes no separator with distinct/);
    expect(() => mysql.stringAgg(u.email, ',', { filter: 'TRUE', syntax: 'filter' })).toThrow(/MySQL \/ MariaDB have no FILTER/);
    expect(() => pg.interval(1.5, 'hours')).toThrow(/the amount is an integer/);
    expect(() => pg.ago(1, 'day' as never)).toThrow(/the unit is one of seconds, minutes/);
    expect(() => pg.extract('week' as never, u.createdAt)).toThrow(/the part is one of/);
    expect(() => pg.case([])).toThrow(/at least one \[condition, value\] branch/);
    expect(() => pg.case([[`${u.id} = 1`] as never])).toThrow(/branch 1 is a \[condition, value\] pair/);
    expect(() => pg.jsonbSet(u.metadata, [] as never, '1')).toThrow(/non-empty array of keys/);
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
  // the entity's default ORDER BY "user"."id" is not valid next to an aggregate on PostgreSQL
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').setOption('disable-global-order');

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

    // the pg driver returns PostgreSQL's bigint sum as a string
    expect({ ...empty, sumOrZero: Number(empty?.sumOrZero) }).toEqual({ sum: null, max: null, sumOrZero: 0 });
  });

  it('SHOULD run the functions written for the database under test', async () => {
    await seed();

    const sql = Sql.for(context.typeormOptions.type);
    const sqliteLike = ['sqlite', 'better-sqlite3'].includes(context.typeormOptions.type);
    const at = `${sqliteLike ? '' : 'TIMESTAMP '}'2026-03-04 05:06:07'`;

    const rows = await users()
      .select(u.id, 'id')
      .addSelect(sql.case([[`${u.id} = 1`, "'one'"], [`${u.id} = 2`, "'two'"]], "'many'"), 'word')
      .addSelect(sql.over(sql.rowNumber(), { orderBy: `${u.id} DESC` }), 'fromEnd')
      .addSelect(sql.over(sql.rank(), { partitionBy: sql.case([[u.isNull('metadata'), '1']], '0'), orderBy: u.id }), 'rankInGroup')
      .addSelect(sql.over(sql.lag(u.firstName), { orderBy: u.id }), 'previous')
      .addSelect(sql.over(sql.lead(u.firstName, 1, "'-'"), { orderBy: u.id }), 'next')
      .addSelect(sql.concat("'x'", sql.nullif(u.firstName, "'Bob'")), 'joined')
      .addSelect(sql.substring(u.firstName, 2, 3), 'middle')
      .addSelect(sql.length(u.firstName), 'length')
      .addSelect(sql.greatest(u.id, '2'), 'atLeastTwo')
      .orderBy(u.id)
      .getRawMany<Record<string, string | number | null>>();

    expect(rows.map((row) => [row.word, Number(row.fromEnd), Number(row.rankInGroup), row.previous, row.next, row.joined, row.middle, Number(row.length), Number(row.atLeastTwo)])).toEqual([
      ['one', 4, 1, null, 'Bob', 'xAlice', 'lic', 5, 2],
      ['two', 3, 1, 'Alice', 'Carol', 'x', 'ob', 3, 2],
      ['many', 2, 2, 'Bob', 'Dave', 'xCarol', 'aro', 5, 3],
      ['many', 1, 2, 'Carol', '-', 'xDave', 'ave', 4, 4],
    ]);

    const scalars = await users()
      .select(sql.extract('year', at), 'year')
      .addSelect(sql.extract('dow', at), 'dow')
      .addSelect(sql.extract('epoch', at), 'epoch')
      .addSelect(sql.extract('day', sql.addInterval(at, 2, 'weeks')), 'dayInTwoWeeks')
      .addSelect(sql.case([[`${sql.ago(1, 'days')} < ${sql.now()}`, '1']], '0'), 'agoIsBefore')
      .addSelect(sql.trim("'  a  '"), 'trimmed')
      .addSelect(sql.stringAgg(u.firstName, ', '), 'names')
      .getRawOne<Record<string, string | number>>();

    expect({
      ...scalars,
      year: Number(scalars?.year),
      dow: Number(scalars?.dow),
      epoch: Number(scalars?.epoch),
      dayInTwoWeeks: Number(scalars?.dayInTwoWeeks),
      agoIsBefore: Number(scalars?.agoIsBefore),
      names: String(scalars?.names).split(', ').sort().join(', '),
    }).toEqual({
      year: 2026,
      dow: 3,
      epoch: Date.UTC(2026, 2, 4, 5, 6, 7) / 1000,
      dayInTwoWeeks: 18,
      agoIsBefore: 1,
      trimmed: 'a',
      names: 'Alice, Bob, Carol, Dave',
    });
  });

  it('SHOULD run the PostgreSQL-only functions on PostgreSQL', async () => {
    if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      return;
    }

    await seed();

    const row = await users()
      .select(Sql.boolOr(`${u.id} > 3`), 'someLate')
      .addSelect(Sql.boolAnd(`${u.id} > 3`), 'allLate')
      .addSelect(Sql.stringAgg(u.firstName, ', ', { orderBy: `${u.id} DESC` }), 'names')
      .addSelect(Sql.toChar(Sql.cast("'2026-03-04'", 'date'), 'YYYY/MM/DD'), 'formatted')
      .addSelect(Sql.splitPart("'a@b.c'", '@', 2), 'domain')
      .addSelect(`${Sql.jsonbSet(`'{"a":{"b":1}}'::jsonb`, ['a', 'b'], Sql.toJsonb("'x'::text"))} #>> '{a,b}'`, 'setValue')
      .addSelect(Sql.jsonbTypeof(`'[1]'::jsonb`), 'jsonType')
      .addSelect(Sql.case([[`${Sql.addInterval(Sql.now(), -1, 'days')} < ${Sql.now()}`, 'true']], 'false'), 'shifted')
      .addSelect(Sql.case([[`${Sql.now()} - ${Sql.interval(1, 'hours')} < ${Sql.now()}`, 'true']], 'false'), 'interval')
      .getRawOne<Record<string, unknown>>();

    expect(row).toEqual({
      someLate: true,
      allLate: false,
      names: 'Dave, Carol, Bob, Alice',
      formatted: '2026/03/04',
      domain: 'b.c',
      setValue: 'x',
      jsonType: 'array',
      shifted: true,
      interval: true,
    });

    const distinct = await context.dataSource.query(
      `SELECT ${Sql.distinctOn('v.x')} v.x, v.y FROM (VALUES (1, 'a'), (1, 'b'), (2, 'c')) v(x, y) ORDER BY v.x, v.y`
    );

    expect(distinct).toEqual([
      { x: 1, y: 'a' },
      { x: 2, y: 'c' },
    ]);

    const elements = await context.dataSource.query(`SELECT value FROM ${Sql.jsonbArrayElements(`'[1, "a"]'::jsonb`)}`);

    expect(elements).toEqual([{ value: 1 }, { value: 'a' }]);
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
