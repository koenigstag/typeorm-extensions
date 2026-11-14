import 'typeorm-extensions/extensions/typed/typed-joins/typed-join-and-map.extension';
import 'typeorm-extensions/extensions/typed/typed-root.extension';
import { SelectQueryBuilder } from 'typeorm';
import { createFakeImages, createFakeUsers, setupTest, sqlAndParametersOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

type UserJoins = { user: UserEntity; images: ImageEntity };
type ImageJoins = { image: ImageEntity; user: UserEntity };

const mappingOf = (query: SelectQueryBuilder<any>) =>
  query.expressionMap.joinAttributes.map((join) => ({
    direction: join.direction,
    alias: join.alias.name,
    mapToProperty: join.mapToProperty,
    isMappingMany: join.isMappingMany,
  }));

const expectSameQuery = (typed: SelectQueryBuilder<any>, plain: SelectQueryBuilder<any>) => {
  expect(sqlAndParametersOf(typed)).toEqual(sqlAndParametersOf(plain));
  expect(mappingOf(typed)).toEqual(mappingOf(plain));
};

const latestImageOfUser = (qb: SelectQueryBuilder<any>) =>
  qb
    .select('i.userId', 'userId')
    .addSelect('MAX(i.id)', 'latestId')
    .from(ImageEntity, 'i')
    .where('i.url <> :skippedUrl', { skippedUrl: 'none' })
    .groupBy('i.userId');

setupTest('join-and-map-typed', undefined, (context) => {
  const seed = async () => {
    const users = await createFakeUsers({ count: 2, getOverrides: (index) => ({ id: index + 1 }) });
    await context.dataSource.getRepository(UserEntity).save(users);

    for (const user of users) {
      const images = await createFakeImages({
        count: 2,
        getOverrides: (index) => ({ id: user.id * 10 + index, userId: user.id }),
      });
      await context.dataSource.getRepository(ImageEntity).save(images);
    }
  };

  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');
  const images = () => context.dataSource.getRepository(ImageEntity).createQueryBuilder('image');

  it('SHOULD map one row to a property of the main alias', async () => {
    await seed();

    const typed = images().leftJoinAndMapOneTyped((i) => i.user, UserEntity, 'owner', 'owner.id = image.userId');
    const plain = images().leftJoinAndMapOne('image.user', UserEntity, 'owner', 'owner.id = image.userId');

    expectSameQuery(typed, plain);
    expect(mappingOf(typed)).toEqual([
      { direction: 'LEFT', alias: 'owner', mapToProperty: 'image.user', isMappingMany: false },
    ]);

    const result = await typed.getMany();

    expect(result).toHaveLength(4);
    expect(result.map((image) => [image.userId, image.user?.id])).toEqual([
      [1, 1],
      [1, 1],
      [2, 2],
      [2, 2],
    ]);
    expect(result[0]?.user).toBeInstanceOf(UserEntity);
  });

  it('SHOULD map many rows to a property of the main alias', async () => {
    await seed();

    const typed = users().innerJoinAndMapManyTyped((u) => u.images, ImageEntity, 'img', 'img.userId = user.id');
    const plain = users().innerJoinAndMapMany('user.images', ImageEntity, 'img', 'img.userId = user.id');

    expectSameQuery(typed, plain);
    expect(mappingOf(typed)).toEqual([
      { direction: 'INNER', alias: 'img', mapToProperty: 'user.images', isMappingMany: true },
    ]);

    const result = await typed.getMany();

    expect(result.map((user) => user.images?.map(({ id }) => id).sort((a, b) => a - b))).toEqual([
      [10, 11],
      [20, 21],
    ]);
  });

  it('SHOULD map one row to a property of a joined alias, with typed() as the root', async () => {
    await seed();

    const typed = users()
      .leftJoinAndSelect('user.images', 'images')
      .typed<UserJoins>()
      .innerJoinAndMapOneTyped((q) => q.images.user, UserEntity, 'owner', 'owner.id = images.userId');
    const plain = users()
      .leftJoinAndSelect('user.images', 'images')
      .innerJoinAndMapOne('images.user', UserEntity, 'owner', 'owner.id = images.userId');

    expectSameQuery(typed, plain);
    expect(mappingOf(typed)[1]).toEqual({
      direction: 'INNER',
      alias: 'owner',
      mapToProperty: 'images.user',
      isMappingMany: false,
    });

    const result = await typed.getMany();

    expect(result.flatMap((user) => user.images?.map((image) => [user.id, image.user?.id]))).toEqual([
      [1, 1],
      [1, 1],
      [2, 2],
      [2, 2],
    ]);
  });

  it('SHOULD map many rows to a property of a joined alias, with typed() as the root', async () => {
    await seed();

    const typed = images()
      .leftJoinAndSelect('image.user', 'user')
      .typed<ImageJoins>()
      .leftJoinAndMapManyTyped((q) => q.user.images, ImageEntity, 'userImages', 'userImages.userId = user.id');
    const plain = images()
      .leftJoinAndSelect('image.user', 'user')
      .leftJoinAndMapMany('user.images', ImageEntity, 'userImages', 'userImages.userId = user.id');

    expectSameQuery(typed, plain);
    expect(mappingOf(typed)[1]).toEqual({
      direction: 'LEFT',
      alias: 'userImages',
      mapToProperty: 'user.images',
      isMappingMany: true,
    });

    const result = await typed.getMany();

    expect(result.map((image) => [image.id, image.user?.images?.map(({ id }) => id).sort((a, b) => a - b)])).toEqual([
      [10, [10, 11]],
      [11, [10, 11]],
      [20, [20, 21]],
      [21, [20, 21]],
    ]);
  });

  it('SHOULD join a subquery factory as the string form does', () => {
    const one = users().leftJoinAndMapOneTyped((u) => u.images, latestImageOfUser, 'latest', 'latest.userId = user.id');
    const onePlain = users().leftJoinAndMapOne('user.images', latestImageOfUser, 'latest', 'latest.userId = user.id');

    expectSameQuery(one, onePlain);
    expect(mappingOf(one)).toEqual([
      { direction: 'LEFT', alias: 'latest', mapToProperty: 'user.images', isMappingMany: false },
    ]);
    expect(sqlAndParametersOf(one)[1]).toEqual(['none']);

    const many = users()
      .leftJoin('user.images', 'images')
      .typed<UserJoins>()
      .innerJoinAndMapManyTyped((q) => q.images.user, latestImageOfUser, 'latest', 'latest.userId = images.userId');
    const manyPlain = users()
      .leftJoin('user.images', 'images')
      .innerJoinAndMapMany('images.user', latestImageOfUser, 'latest', 'latest.userId = images.userId');

    expectSameQuery(many, manyPlain);
    expect(mappingOf(many)[1]).toEqual({
      direction: 'INNER',
      alias: 'latest',
      mapToProperty: 'images.user',
      isMappingMany: true,
    });
  });
});
