import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

setupTest('where-typed.where', undefined, (context) => {
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
    const whereInQuery = selectQuery.whereTyped((u) => u.id, 'IN', [1, 3, 5, 7, 9]);

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
    const whereInQuery = selectQuery.whereTyped((u) => u.id, 'IN', [11, 12, 13]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.getMany();
    expect(result).toHaveLength(0);
  });

  it('SHOULD return empty list on condition', async () => {
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
    const whereQuery = selectQuery.whereTyped((u) => u.id, '=', 11);

    expect(whereQuery.getQuery()).not.toContain('"user"."id" IN (');
    expect(whereQuery.getQuery()).toContain('"user"."id" = ');

    const result = await whereQuery.getMany();
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
    const whereInQuery = selectQuery.whereTyped((u) => u.id, 'NOT IN', [1, 3, 5, 7, 9]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereInQuery.getMany();
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
    const whereInQuery = selectQuery.whereTyped((u) => u.id, 'NOT IN', [11, 12, 13]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereInQuery.getMany();
    expect(result).toHaveLength(10);
  });

  it('SHOULD return full list on not condition', async () => {
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
    const whereNotQuery = selectQuery.whereTyped((u) => u.id, '!=', 11);

    expect(whereNotQuery.getQuery()).not.toContain('"user"."id" NOT IN (');
    expect(whereNotQuery.getQuery()).toContain('"user"."id" != ');

    const result = await whereNotQuery.getMany();
    expect(result).toHaveLength(10);
  });
});
