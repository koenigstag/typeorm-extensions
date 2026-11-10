import 'typeorm-extensions/extensions/calculated-column.extension';
import 'typeorm-extensions/extensions/cursor-pagination.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import { setupTest, createFakeUsers, createFakeImages, nativeSql } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

setupTest('CalculatedColumn', undefined, (context) => {
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

  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');

  it('SHOULD be no column of the table, and be left out of inserts and plain loads', async () => {
    await seed();

    const queryRunner = context.dataSource.createQueryRunner();
    const table = await queryRunner.getTable('users');
    await queryRunner.release();

    expect(table?.columns.map(({ name }) => name)).not.toEqual(expect.arrayContaining(['imagesCount']));
    expect(table?.columns.map(({ name }) => name)).not.toEqual(expect.arrayContaining(['latestImageUrl']));

    const [first] = await users().getMany();
    expect(first.imagesCount).toBeUndefined();
  });

  it('SHOULD fill the properties from an expression and a subquery, converted by their types', async () => {
    await seed();

    const found = await users()
      .addSelectCalculated(
        nativeSql('(SELECT COUNT(*) FROM "images" "counted" WHERE "counted"."userId" = "user"."id")'),
        'imagesCount',
      )
      .addSelectCalculated(
        (qb) =>
          qb
            .select('MAX(latest.url)')
            .from(ImageEntity, 'latest')
            .where(`latest.userId = ${nativeSql('"user"."id"')}`)
            // the entity's ORDER BY id can't stand next to MAX()
            .setOption('disable-global-order'),
        'latestImageUrl',
      )
      .getMany();

    // a COUNT is a bigint string on PostgreSQL: the number type of the property converts it
    expect(found.map(({ id, imagesCount, latestImageUrl }) => [id, imagesCount, latestImageUrl])).toEqual([
      [1, 2, 'image-2'],
      [2, 2, 'image-4'],
      [3, 0, null],
    ]);
  });

  it('SHOULD keep the decimals of a number, and read a false flag as false on every database', async () => {
    await seed();

    const found = await users()
      .addSelectCalculated(
        nativeSql('(SELECT AVG("averaged"."id") FROM "images" "averaged" WHERE "averaged"."userId" = "user"."id")'),
        'averageImageId',
      )
      .addSelectCalculated(
        nativeSql('(EXISTS (SELECT 1 FROM "images" "any" WHERE "any"."userId" = "user"."id"))'),
        'hasImages',
      )
      .getMany();

    expect(found.map(({ id, averageImageId, hasImages }) => [id, averageImageId, hasImages])).toEqual([
      [1, 1.5, true],
      [2, 3.5, true],
      [3, null, false],
    ]);
  });

  it('SHOULD fill the property of a joined entity, by its alias', async () => {
    await seed();

    const [image] = await context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder('image')
      .leftJoinAndSelect('image.user', 'owner')
      .addSelectCalculated(
        nativeSql('(SELECT COUNT(*) FROM "images" "counted" WHERE "counted"."userId" = "owner"."id")'),
        'imagesCount',
        'owner',
      )
      .orderBy('image.id')
      .getMany();

    expect(image.user?.imagesCount).toBe(2);
  });

  it('SHOULD throw for a property that is no @CalculatedColumn, or an alias without an entity', () => {
    expect(() => users().addSelectCalculated('1', 'firstName')).toThrow(TypeError);
    expect(() => users().addSelectCalculated('1', 'imagesCount', 'other')).toThrow(TypeError);
  });

  it('SHOULD throw for a calculated property where the table needs a column', async () => {
    expect(() => users().whereTyped((u) => u.imagesCount, '>', 1)).toThrow(/imagesCount is a @CalculatedColumn/);
    expect(() => users().orderByTyped((u) => u.imagesCount)).toThrow(/imagesCount is a @CalculatedColumn/);
    await expect(
      context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .getManyWithCursor({ pageSize: 1 }, { orderBy: [{ field: 'imagesCount', direction: 'ASC' }] }),
    ).rejects.toThrow(/"imagesCount" is not a column/);
  });
});
