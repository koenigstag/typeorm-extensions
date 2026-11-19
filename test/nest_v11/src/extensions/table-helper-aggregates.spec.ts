import { DatabaseType } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest, createFakeUsers, createFakeImages } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

describe('tableHelper aggregates SQL', () => {
  const images = (driver?: DatabaseType) => tableHelper<ImageEntity>('image', { driver });

  it('SHOULD sum into 0 for no rows, with a filter written either way', () => {
    const filter = images().where('id', '> 1');

    expect(images().sum('id')).toBe('COALESCE(SUM("image"."id"), 0)');
    expect(images().sum('userId', { filter })).toBe(
      'COALESCE(SUM(CASE WHEN "image"."id" > 1 THEN "image"."userId" END), 0)',
    );
    expect(images().sum('userId', { filter, syntax: 'filter' })).toBe(
      'COALESCE(SUM("image"."userId") FILTER (WHERE "image"."id" > 1), 0)',
    );
    expect(() => images().sum('id', { filter, syntax: 'where' as never })).toThrow(/'case' or 'filter'/);
    // MySQL has no FILTER (WHERE …): a TypeError instead of a syntax error from the database
    expect(() => images('mysql').sum('id', { filter, syntax: 'filter' })).toThrow(/no FILTER/);
    expect(() => images('mysql').count(undefined, { filter, syntax: 'filter' })).toThrow(/no FILTER/);
  });

  it('SHOULD aggregate a column into a PostgreSQL array, {} for no rows', () => {
    expect(images().arrayAgg('id')).toBe(`COALESCE(array_agg("image"."id"), '{}')`);
    expect(
      images().arrayAgg('url', { distinct: true, orderBy: ['url', 'DESC'], filter: images().isNotNull('id') }),
    ).toBe(
      `COALESCE(array_agg(DISTINCT "image"."url" ORDER BY "image"."url" DESC) FILTER (WHERE "image"."id" IS NOT NULL), '{}')`,
    );

    // PostgreSQL orders a DISTINCT aggregate only by its argument
    expect(() => images().arrayAgg('url', { distinct: true, orderBy: 'id' })).toThrow(/only be ordered by "url"/);
    expect(() => images().arrayAgg('id', { orderBy: ['id', 'UP' as 'ASC'] })).toThrow(/'ASC' or 'DESC'/);
    expect(() => images('mysql').arrayAgg('id')).toThrow(/arrayAgg\(\): PostgreSQL only, the driver is "mysql": use jsonAgg/);
    expect(() => images('better-sqlite3').arrayAgg('id')).toThrow(/use jsonAgg/);
    expect(() => images('mssql').arrayAgg('id')).toThrow(/use jsonAgg/);
  });

  it('SHOULD cast a count to SIGNED on MySQL, where CAST(… AS integer) is a syntax error', () => {
    expect(images('mysql').count('id')).toBe('CAST(COUNT(`image`.`id`) AS SIGNED)');
    expect(images('postgres').count('id')).toBe('CAST(COUNT("image"."id") AS integer)');
  });
});

setupTest('tableHelper aggregate queries', undefined, (context) => {
  // user 1 has images 1 and 2, user 2 images 3 and 4, user 3 none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 4,
        getOverrides: (i) => ({ id: i + 1, userId: i < 2 ? 1 : 2, url: `image-${i + 1}` }),
      }),
    );
  };

  const perUser = async <Row>(aggregates: (image: ReturnType<typeof tableHelper<ImageEntity>>) => Record<string, string>) => {
    const image = tableHelper<ImageEntity>('image', { driver: context.typeormOptions.type });
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .leftJoin('user.images', 'image')
      .groupBy('user.id')
      .orderBy('user.id');

    for (const [alias, sql] of Object.entries(aggregates(image))) {
      query.addSelect(sql, alias);
    }

    return query.getRawMany<Row>();
  };

  it('SHOULD sum and count the rows of a LEFT JOIN, 0 without a match', async () => {
    await seed();

    const rows = await perUser<{ id: number; total: unknown; afterFirst: unknown; count: unknown }>((image) => ({
      total: image.sum('id'),
      afterFirst: image.sum('id', { filter: image.where('id', '> 1') }),
      count: image.count('id'),
    }));

    // SUM is a bigint / DECIMAL string on PostgreSQL / MySQL, and a count a BIGINT string on MySQL
    expect(rows.map(({ id, total, afterFirst, count }) => [Number(id), Number(total), Number(afterFirst), Number(count)])).toEqual([
      [1, 3, 2, 2],
      [2, 7, 7, 2],
      [3, 0, 0, 0],
    ]);
  });

  (postgresLikeDrivers.includes(context.typeormOptions.type as never) ? it : it.skip)(
    'SHOULD aggregate ordered arrays, {} without a match (PostgreSQL)',
    async () => {
      await seed();

      const rows = await perUser<{ id: number; ids: number[]; urls: string[] }>((image) => ({
        ids: image.arrayAgg('id', { orderBy: ['id', 'DESC'], filter: image.isNotNull('id') }),
        urls: image.arrayAgg('url', { distinct: true, orderBy: 'url' }),
      }));

      expect(rows.map(({ ids, urls }) => [ids, urls])).toEqual([
        [[2, 1], ['image-1', 'image-2']],
        [[4, 3], ['image-3', 'image-4']],
        // without the filter a LEFT JOIN without a match gives {NULL}
        [[], [null]],
      ]);
    },
  );
});
