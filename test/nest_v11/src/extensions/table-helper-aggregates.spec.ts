import { DatabaseType } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest, createFakeUsers, createFakeImages } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

describe('tableHelper aggregates SQL', () => {
  const images = (driver?: DatabaseType) => tableHelper<ImageEntity>('image', { driver });

  it('SHOULD write a count filter either way, and refuse FILTER on MySQL', () => {
    const filter = images().where('id', '> 1');

    expect(images().count('userId', { filter })).toBe(
      'CAST(COUNT(CASE WHEN "image"."id" > 1 THEN "image"."userId" END) AS integer)',
    );
    expect(images().count('userId', { filter, syntax: 'filter' })).toBe(
      'CAST(COUNT("image"."userId") FILTER (WHERE "image"."id" > 1) AS integer)',
    );
    expect(() => images().count('id', { filter, syntax: 'where' as never })).toThrow(/'case' or 'filter'/);
    // MySQL has no FILTER (WHERE …): a TypeError instead of a syntax error from the database
    expect(() => images('mysql').count(undefined, { filter, syntax: 'filter' })).toThrow(/no FILTER/);
  });

  it('SHOULD cast a count to SIGNED on MySQL, where CAST(… AS integer) is a syntax error', () => {
    expect(images('mysql').count('id')).toBe('CAST(COUNT(`image`.`id`) AS SIGNED)');
    expect(images('postgres').count('id')).toBe('CAST(COUNT("image"."id") AS integer)');
  });
});

setupTest('tableHelper aggregate queries', undefined, (context) => {
  it('SHOULD count the rows of a LEFT JOIN, 0 without a match', async () => {
    // user 1 has images 1 and 2, user 2 images 3 and 4, user 3 none
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 4,
        getOverrides: (i) => ({ id: i + 1, userId: i < 2 ? 1 : 2, url: `image-${i + 1}` }),
      }),
    );

    const image = tableHelper<ImageEntity>('image', { driver: context.typeormOptions.type });
    const rows = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect(image.count('id'), 'count')
      .addSelect(image.count('id', { filter: image.where('id', '> 1') }), 'afterFirst')
      .leftJoin('user.images', 'image')
      .groupBy('user.id')
      .orderBy('user.id')
      .getRawMany<{ id: number; count: unknown; afterFirst: unknown }>();

    // a count is a BIGINT string on MySQL
    expect(rows.map(({ id, count, afterFirst }) => [Number(id), Number(count), Number(afterFirst)])).toEqual([
      [1, 2, 1],
      [2, 2, 2],
      [3, 0, 0],
    ]);
  });
});
