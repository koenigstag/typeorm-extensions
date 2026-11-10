import 'typeorm-extensions/extensions/typed/typed-having/typed-having.extension';
import { createFakeUsers, setupTest, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

setupTest('having-typed', undefined, (context) => {
  // user 1 has images 1, 2; user 2 images 3, 4, 5; user 3 none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource
      .getRepository(ImageEntity)
      .save([1, 1, 2, 2, 2].map((userId, i) => new ImageEntity({ id: i + 1, userId, url: `image-${i + 1}` })));
  };

  const imagesPerUser = () =>
    context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .leftJoin('user.images', 'images')
      .groupBy('user.id')
      .orderBy('user.id');

  const ids = async (query: ReturnType<typeof imagesPerUser>) =>
    (await query.getRawMany<{ id: number | string }>()).map(({ id }) => Number(id));

  it('SHOULD compare an aggregate of a property with a value of its own parameter', async () => {
    await seed();

    const query = imagesPerUser().havingTyped('COUNT', (u) => u.images.id, '>=', 2);

    expect(sqlOf(query)).toMatch(/HAVING COUNT\("images"\."id"\) >= :having_\w+/);
    expect(await ids(query)).toEqual([1, 2]);
  });

  it('SHOULD add AND / OR conditions, COUNT(*), COUNT DISTINCT, SUM and MAX', async () => {
    await seed();

    // the largest image id of user 1 is 2, of user 2 is 5
    expect(
      await ids(imagesPerUser().havingTyped('COUNT', (u) => u.images.id, '>=', 2).andHavingTyped('MAX', (u) => u.images.id, '<', 5)),
    ).toEqual([1]);

    // a LEFT JOIN without a match is one row: COUNT(*) is 1 for user 3, COUNT(images.id) is 0
    expect(
      await ids(imagesPerUser().havingTyped('SUM', (u) => u.images.id, '=', 12).orHavingTyped('COUNT', '*', '=', 1)),
    ).toEqual([2, 3]);

    expect(await ids(imagesPerUser().havingTyped('COUNT DISTINCT', (u) => u.images.userId, '= :one', { one: 1 }))).toEqual([
      1, 2,
    ]);
  });

  it('SHOULD reject * for an aggregate other than COUNT, and an unknown aggregate', () => {
    expect(() => imagesPerUser().havingTyped('SUM' as 'COUNT', '*', '>', 1)).toThrow(/only COUNT takes '\*', got SUM/);
    expect(() => imagesPerUser().havingTyped('COUNT(*) > 0 OR' as 'COUNT', (u) => u.id, '>', 1)).toThrow(
      /the aggregate is one of COUNT, COUNT DISTINCT, SUM, AVG, MIN, MAX/,
    );
  });
});
