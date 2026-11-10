import { DatabaseType } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest, createFakeUsers, createFakeImages, mysqlRun } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

describe('tableHelper JSON SQL', () => {
  const images = (driver?: DatabaseType) => tableHelper<ImageEntity>('image', { driver });

  it('SHOULD build an object of columns, keyed by column or by a key map, for each database', () => {
    expect(images().jsonBuildObject(['id', 'url'])).toBe(`json_build_object('id', "image"."id", 'url', "image"."url")`);
    expect(images().jsonBuildObject({ imageId: 'id', "it's": 'url' }, { jsonb: true })).toBe(
      `jsonb_build_object('imageId', "image"."id", 'it''s', "image"."url")`,
    );
    expect(images('mysql').jsonBuildObject(['id'])).toBe('JSON_OBJECT(\'id\', `image`.`id`)');
    expect(images('better-sqlite3').jsonBuildObject(['id'])).toBe(`json_object('id', "image"."id")`);
  });

  it('SHOULD aggregate into an array, [] for a group without rows', () => {
    expect(images().jsonAgg(images().column('url'), { orderBy: ['id', 'DESC'], filter: images().isNotNull('id') })).toBe(
      `COALESCE(json_agg("image"."url" ORDER BY "image"."id" DESC) FILTER (WHERE "image"."id" IS NOT NULL), CAST('[]' AS json))`,
    );
    expect(images('mysql').jsonAgg('x')).toBe('COALESCE(JSON_ARRAYAGG(x), JSON_ARRAY())');
  });

  it('SHOULD reject what the database or the SQL cannot take', () => {
    expect(() => images().jsonBuildObject([])).toThrow(TypeError);
    expect(() => images('mysql').jsonBuildObject(['id'], { jsonb: true })).toThrow(TypeError);
    expect(() => images('mysql').jsonAgg('x', { orderBy: 'id' })).toThrow(TypeError);
    expect(() => images().jsonAgg('x', { orderBy: ['id', 'DESC; DROP TABLE images' as 'DESC'] })).toThrow(TypeError);
  });
});

setupTest('tableHelper JSON queries', undefined, (context) => {
  // SQLite returns the JSON as text, PostgreSQL and MySQL parsed
  const parse = <T>(value: unknown): T[] => (typeof value === 'string' ? JSON.parse(value) : value) as T[];

  // users 1 and 2 have two images each, user 3 none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 4,
        getOverrides: (i) => ({ id: i + 1, userId: i < 2 ? 1 : 2, url: `image-${i + 1}` }),
      }),
    );
  };

  const imagesPerUser = (aggregate: (image: ReturnType<typeof tableHelper<ImageEntity>>) => string) => {
    const image = tableHelper<ImageEntity>('image', { driver: context.typeormOptions.type });

    return context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect(aggregate(image), 'images')
      .leftJoin('user.images', 'image')
      .groupBy('user.id')
      .orderBy('user.id');
  };

  it('SHOULD aggregate the objects of each group', async () => {
    await seed();

    const rows = await imagesPerUser((image) => image.jsonAgg(image.jsonBuildObject({ imageId: 'id' })))
      .andWhere('image.id IS NOT NULL')
      .getRawMany();

    expect(rows.map(({ id, images }) => [id, parse<{ imageId: number }>(images).map(({ imageId }) => imageId).sort()])).toEqual([
      [1, [1, 2]],
      [2, [3, 4]],
    ]);
  });

  // MySQL's JSON_ARRAYAGG has no ORDER BY and no FILTER
  (mysqlRun ? it.skip : it)('SHOULD order the array and give [] to a group without a match', async () => {
    await seed();

    const rows = await imagesPerUser((image) =>
      image.jsonAgg(image.column('url'), { orderBy: ['id', 'DESC'], filter: image.isNotNull('id') }),
    ).getRawMany();

    expect(rows.map(({ id, images }) => [id, parse(images)])).toEqual([
      [1, ['image-2', 'image-1']],
      [2, ['image-4', 'image-3']],
      [3, []],
    ]);
  });
});
