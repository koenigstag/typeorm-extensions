import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { createFakeImages, createFakeUsers, setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

setupTest('join-typed', undefined, (context) => {
  it('SHOULD left join and not select', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const imagesRepository = context.dataSource.getRepository(ImageEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    // create 5 images for each user
    for (const user of fakeUsers) {
      const images = await createFakeImages({
        count: 5,
        getOverrides: (index) => ({
          id: user.id + index + 1,
          userId: user.id,
        }),
      });
      await imagesRepository.save(images);
    }

    const selectQuery = usersRepository.createQueryBuilder('user');

    const simpleSelectQuery = selectQuery
      .clone()
      .leftJoin('user.images', 'images');
    const selectTypedQuery = selectQuery
      .clone()
      .leftJoinTyped((u) => u.images, 'images');

    expect(simpleSelectQuery.getQuery()).toEqual(selectTypedQuery.getQuery());
    expect(selectTypedQuery.getQuery()).toContain(
      'LEFT JOIN "images" "images" ON "images"."userId"="user"."id"',
    );

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.images).toBeUndefined();
    expect(result[0]?.images).not.toBeInstanceOf(Array);
  });

  it('SHOULD inner join and not select', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const imagesRepository = context.dataSource.getRepository(ImageEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');

    const simpleSelectQuery = selectQuery
      .clone()
      .innerJoin('user.images', 'images');
    const selectTypedQuery = selectQuery
      .clone()
      .innerJoinTyped((u) => u.images, 'images');

    expect(simpleSelectQuery.getQuery()).toEqual(selectTypedQuery.getQuery());
    expect(selectTypedQuery.getQuery()).toContain(
      'INNER JOIN "images" "images" ON "images"."userId"="user"."id"',
    );

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(0);
    expect(result[0]).toBeUndefined();
  });

  it('SHOULD left join and select', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const imagesRepository = context.dataSource.getRepository(ImageEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    // create 5 images for each user
    for (const user of fakeUsers) {
      const images = await createFakeImages({
        count: 5,
        getOverrides: (index) => ({
          id: user.id + index + 1,
          userId: user.id,
        }),
      });
      await imagesRepository.save(images);
    }

    const selectQuery = usersRepository.createQueryBuilder('user');

    const simpleSelectQuery = selectQuery
      .clone()
      .leftJoinAndSelect('user.images', 'images');
    const selectTypedQuery = selectQuery
      .clone()
      .leftJoinAndSelectTyped((u) => u.images, 'images');

    expect(simpleSelectQuery.getQuery()).toEqual(selectTypedQuery.getQuery());
    expect(selectTypedQuery.getQuery()).toContain(
      'LEFT JOIN "images" "images" ON "images"."userId"="user"."id"',
    );

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.images).toBeDefined();
    expect(result[0]?.images).toBeInstanceOf(Array);
  });

  it('SHOULD inner join and select', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const imagesRepository = context.dataSource.getRepository(ImageEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    // create 5 images for each user
    for (const user of fakeUsers) {
      const images = await createFakeImages({
        count: 5,
        getOverrides: (index) => ({
          id: user.id + index + 1,
          userId: user.id,
        }),
      });
      await imagesRepository.save(images);
    }

    const selectQuery = usersRepository.createQueryBuilder('user');

    const simpleSelectQuery = selectQuery
      .clone()
      .innerJoinAndSelect('user.images', 'images');
    const selectTypedQuery = selectQuery
      .clone()
      .innerJoinAndSelectTyped((u) => u.images, 'images');

    expect(simpleSelectQuery.getQuery()).toEqual(selectTypedQuery.getQuery());
    expect(selectTypedQuery.getQuery()).toContain(
      'INNER JOIN "images" "images" ON "images"."userId"="user"."id"',
    );

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.images).toBeDefined();
    expect(result[0]?.images).toBeInstanceOf(Array);
  });
});
