import 'typeorm-extensions/extensions/typed/typed-distinct/typed-distinct.extension';
import { createFakeImages, createFakeUsers, setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

const distinctOnSupportedDrivers = postgresLikeDrivers;

setupTest('distinct-typed', undefined, (context) => {
  if (!distinctOnSupportedDrivers.includes(context.typeormOptions.driver)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD distinct select', async () => {
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

    const simpleSelectQuery = selectQuery.clone().distinctOn(['user.email']);
    const selectTypedQuery = selectQuery
      .clone()
      .distinctOnTyped((u) => u.email);

    expect(simpleSelectQuery.getQuery()).toEqual(selectTypedQuery.getQuery());
    expect(selectTypedQuery.getQuery()).toContain(
      'DISTINCT ON ("user"."email")',
    );

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.images).toBeInstanceOf(Array);
  });
});
