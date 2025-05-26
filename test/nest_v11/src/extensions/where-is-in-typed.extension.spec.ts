import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { setupTest, createFakeUsers, createRandomId } from '../test-utils';
import { UserEntity } from '../models';
import { selectElements } from '../utils';

setupTest('where-is-in-typed.whereIsIn', undefined, (context) => {
  it('SHOULD apply where IN correctly', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');

    const userIds = selectElements(
      fakeUsers.map((u) => u.id),
      'even',
    );
    const whereInQuery = selectQuery
      .clone()
      .whereIsInTyped((u) => u.id, userIds);

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(userIds.length);
    expect(result.map((user) => user.id)).toEqual(userIds);
  });

  it('SHOULD return empty array when no matches', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery
      .clone()
      .whereIsInTyped(
        (u) => u.id,
        [
          createRandomId(1000, 1100),
          createRandomId(1101, 1200),
          createRandomId(1201, 1300),
        ],
      );

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(0);
  });

  it('SHOULD handle empty array input', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery.clone().whereIsInTyped((u) => u.id, []);

    expect(whereInQuery.getQuery().toLowerCase()).toContain('false');
    expect(whereInQuery.getQuery()).not.toContain('"user"."id" IN (');

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(0);
  });
});

setupTest('where-is-in-typed.whereIsNotIn', undefined, (context) => {
  it('SHOULD apply where NOT IN correctly', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const userIds = selectElements(
      fakeUsers.map((u) => u.id),
      'even',
    );
    const whereNotInQuery = usersRepository
      .createQueryBuilder('user')
      .select('user.id')
      .whereIsNotInTyped((u) => u.id, userIds);

    const usersQuery = usersRepository
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.id NOT IN (:...userIds)', { userIds });

    expect(whereNotInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereNotInQuery.select('user.id').getMany();
    const users = await usersQuery.getMany();

    expect(result).toHaveLength(users.length);
    expect(result.map((user) => user.id)).toEqual(
      users.map((user) => user.id).filter((id) => !userIds.includes(id)),
    );
  });

  it('SHOULD return all ids array when no conditions met', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereNotInQuery = selectQuery
      .clone()
      .whereIsNotInTyped(
        (u) => u.id,
        [
          createRandomId(1000, 1100),
          createRandomId(1101, 1200),
          createRandomId(1201, 1300),
        ],
      );

    expect(whereNotInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const otherUsers = await selectQuery.clone().select('user.id').getMany();

    const result = await whereNotInQuery.select('user.id').getMany();
    expect(result).toHaveLength(otherUsers.length);
    expect(result.map((user) => user.id)).toEqual(
      otherUsers.map((user) => user.id),
    );
  });

  it('SHOULD return full list on empty array input', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereNotInQuery = selectQuery
      .clone()
      .whereIsNotInTyped((u) => u.id, []);

    expect(whereNotInQuery.getQuery()).not.toContain('"user"."id" NOT IN (');

    const otherUsers = await selectQuery.clone().select('user.id').getMany();

    const result = await whereNotInQuery.select('user.id').getMany();
    expect(result).toHaveLength(otherUsers.length);
    expect(result.map((user) => user.id)).toEqual(
      otherUsers.map((user) => user.id),
    );
  });
});
