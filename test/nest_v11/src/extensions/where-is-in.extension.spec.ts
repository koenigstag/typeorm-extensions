import 'typeorm-extensions/extensions/where-is-in.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

setupTest('where-is-in.whereIsIn', undefined, (context) => {
  it('SHOULD apply where IN correctly', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery.whereIsIn('user.id', [1, 3, 5, 7, 9]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.getMany();
    expect(result).toHaveLength(5);
    expect(result.map((user) => user.id)).toEqual([1, 3, 5, 7, 9]);
  });

  it('SHOULD return empty array when no matches', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery.whereIsIn('user.id', [11, 12, 13]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.getMany();
    expect(result).toHaveLength(0);
  });

  it('SHOULD handle empty array input', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery.whereIsIn('user.id', []);

    expect(whereInQuery.getQuery().toLowerCase()).toContain('false');
    expect(whereInQuery.getQuery()).not.toContain('"user"."id" IN (');

    const result = await whereInQuery.getMany();
    expect(result).toHaveLength(0);
  });
});

setupTest('where-is-in.whereIsNotIn', undefined, (context) => {
  it('SHOULD apply where NOT IN correctly', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereNotInQuery = selectQuery.whereIsNotIn('user.id', [1, 3, 5, 7, 9]);

    expect(whereNotInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereNotInQuery.getMany();
    expect(result).toHaveLength(5);
    expect(result.map((user) => user.id)).toEqual([2, 4, 6, 8, 10]);
  });

  it('SHOULD return all ids array when no conditions met', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereNotInQuery = selectQuery.whereIsNotIn('user.id', [11, 12, 13]);

    expect(whereNotInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereNotInQuery.getMany();
    expect(result).toHaveLength(10);
  });

  it('SHOULD return full list on empty array input', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
      getOverrides: (index) => ({
        id: index + 1,
      }),
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereNotInQuery = selectQuery.whereIsNotIn('user.id', []);

    expect(whereNotInQuery.getQuery()).not.toContain('"user"."id" NOT IN (');

    const result = await whereNotInQuery.getMany();
    expect(result).toHaveLength(10);
  });
});
