import 'typeorm-extensions/extensions/calculated-column.extension';
import 'typeorm-extensions/extensions/order.extension';
import 'typeorm-extensions/extensions/cursor-pagination.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import 'typeorm-extensions/extensions/typed/typed-calculated/typed-calculated-column.extension';
import 'typeorm-extensions/extensions/typed/typed-root.extension';
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

  describe('ordered by', () => {
    // user 1 has one image, user 2 three, user 3 none
    const seedCounts = async () => {
      await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
      await context.dataSource.getRepository(ImageEntity).save(
        [2, 1, 2, 2].map((userId, i) => new ImageEntity({ id: i + 1, userId, url: `image-${i + 1}` })),
      );
    };

    const imagesCount = () =>
      nativeSql('(SELECT COUNT(*) FROM "images" "counted" WHERE "counted"."userId" = "user"."id")');

    it('SHOULD order by the value, also when take / skip page through a join', async () => {
      await seedCounts();

      const page = (skip: number) =>
        users()
          .addSelectCalculated(imagesCount(), 'imagesCount')
          .leftJoinAndSelect('user.images', 'images')
          .orderByCalculated('imagesCount', 'DESC')
          .addOrderBy('user.id')
          .skip(skip)
          .take(2)
          .getMany();

      // TypeORM pages a join through a DISTINCT query over the select aliases, then loads the page
      const [first, second] = [await page(0), await page(2)];

      expect(first.map(({ id, imagesCount, images }) => [id, imagesCount, images?.length])).toEqual([
        [2, 3, 3],
        [1, 1, 1],
      ]);
      expect(second.map(({ id, imagesCount }) => [id, imagesCount])).toEqual([[3, 0]]);
    });

    it('SHOULD order by the value through applyOrder and of a joined alias', async () => {
      await seedCounts();

      const ordered = await users()
        .addSelectCalculated(imagesCount(), 'imagesCount')
        .applyOrder<UserEntity>({ field: 'imagesCount', direction: 'asc' }, { resetPreviousOrder: true })
        .getMany();

      expect(ordered.map(({ id }) => id)).toEqual([3, 1, 2]);

      const images = await context.dataSource
        .getRepository(ImageEntity)
        .createQueryBuilder('image')
        .leftJoinAndSelect('image.user', 'owner')
        .addSelectCalculated(
          nativeSql('(SELECT COUNT(*) FROM "images" "counted" WHERE "counted"."userId" = "owner"."id")'),
          'imagesCount',
          'owner',
        )
        .orderByCalculated('imagesCount', 'ASC', undefined, 'owner')
        .addOrderBy('image.id', 'DESC')
        .getMany();

      expect(images.map(({ id }) => id)).toEqual([2, 4, 3, 1]);
    });

    it('SHOULD throw for a property that is not selected or no @CalculatedColumn', () => {
      expect(() => users().orderByCalculated('imagesCount')).toThrow(
        /orderByCalculated: UserEntity\.imagesCount isn't selected: select it with addSelectCalculated first/,
      );
      expect(() => users().addOrderByCalculated('firstName')).toThrow(/UserEntity\.firstName is not a @CalculatedColumn/);
      expect(() => users().applyOrder<UserEntity>({ field: 'imagesCount' })).toThrow(/applyOrder: .* isn't selected/);
    });

    describe('with typed callbacks', () => {
      it('SHOULD select into and order by the property of the main alias the callback picks', async () => {
        await seedCounts();

        const ordered = await users()
          .addSelectCalculatedTyped(imagesCount(), (user) => user.imagesCount)
          .orderByCalculatedTyped((user) => user.imagesCount, 'DESC')
          .getMany();

        expect(ordered.map(({ id, imagesCount }) => [id, imagesCount])).toEqual([
          [2, 3],
          [1, 1],
          [3, 0],
        ]);

        const appended = users()
          .addSelectCalculatedTyped(imagesCount(), (user) => user.imagesCount)
          .addOrderByCalculatedTyped((user) => user.imagesCount, 'DESC');

        expect(Object.entries(appended.expressionMap.orderBys)).toEqual([
          ['user.id', 'ASC'],
          [expect.stringMatching(/^calculated_/), 'DESC'],
        ]);
      });

      it('SHOULD pick the property of a joined alias through the typed root', async () => {
        await seedCounts();

        const images = await context.dataSource
          .getRepository(ImageEntity)
          .createQueryBuilder('image')
          .leftJoinAndSelect('image.user', 'owner')
          .typed<{ image: ImageEntity; owner: UserEntity }>()
          .addSelectCalculatedTyped(
            nativeSql('(SELECT COUNT(*) FROM "images" "counted" WHERE "counted"."userId" = "owner"."id")'),
            (q) => q.owner.imagesCount,
          )
          .orderByCalculatedTyped((q) => q.owner.imagesCount, 'ASC')
          .addOrderBy('image.id', 'DESC')
          .getMany();

        expect(images.map(({ id, user }) => [id, user?.imagesCount])).toEqual([
          [2, 1],
          [4, 3],
          [3, 3],
          [1, 3],
        ]);
      });

      it('SHOULD throw for a property that is no @CalculatedColumn, not selected, or of an alias without an entity', () => {
        expect(() => users().addSelectCalculatedTyped('1', (user) => user.firstName)).toThrow(
          /addSelectCalculatedTyped: UserEntity\.firstName is not a @CalculatedColumn/,
        );
        expect(() => users().orderByCalculatedTyped((user) => user.imagesCount)).toThrow(
          /orderByCalculatedTyped: UserEntity\.imagesCount isn't selected/,
        );
        expect(() =>
          users()
            .typed<{ user: UserEntity; other: UserEntity }>()
            .addSelectCalculatedTyped('1', (q) => q.other.imagesCount),
        ).toThrow(/addSelectCalculatedTyped: the alias "other" has no entity with "imagesCount"/);
      });
    });
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
