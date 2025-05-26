import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { setupTest, createFakeUsers, createRandomId } from '../test-utils';
import { UserEntity } from '../models';
import { selectElements } from '../utils';
import { faker } from '@faker-js/faker';

setupTest('where-typed.where', undefined, (context) => {
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
    const whereInQuery = selectQuery.clone().whereTyped((u) => u.id, 'IN', userIds);

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

    const whereInQuery = selectQuery.clone().whereTyped((u) => u.id, 'IN', [
      createRandomId(1000, 1100),
      createRandomId(1101, 1200),
      createRandomId(1201, 1300),
    ]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" IN (');

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(0);
  });

  it('SHOULD return empty list on condition', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');

    const userId = fakeUsers[0].id;
    const whereQuery = selectQuery.clone().whereTyped(
      (u) => u.id,
      '=',
      userId,
    );

    expect(whereQuery.getQuery()).toContain('"user"."id" = ');

    const result = await whereQuery.select('user.id').getMany();
    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(userId);
  });
});

setupTest('where-is-in.whereIsNotIn', undefined, (context) => {
  it('SHOULD apply where NOT IN correctly', async () => {
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
    const whereInQuery = selectQuery.clone().whereTyped((u) => u.id, 'NOT IN', userIds);

    expect(whereInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const otherIds = fakeUsers
      .map((u) => u.id)
      .filter((id) => !userIds.includes(id));

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(otherIds.length);
    expect(result.map((user) => user.id)).toEqual(otherIds);
  });

  it('SHOULD return all ids array when no conditions met', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const whereInQuery = selectQuery.clone().whereTyped((u) => u.id, 'NOT IN', [
      createRandomId(1000, 1100),
      createRandomId(1101, 1200),
      createRandomId(1201, 1300),
    ]);

    expect(whereInQuery.getQuery()).toContain('"user"."id" NOT IN (');

    const result = await whereInQuery.select('user.id').getMany();
    expect(result).toHaveLength(fakeUsers.length);
  });

  it('SHOULD return full list on not condition', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    let fakeUsers = await createFakeUsers({
      count: 10,
    });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');

    const whereNotQuery = selectQuery.clone().whereTyped(
      (u) => u.id,
      '!=',
      createRandomId(1000, 1100),
    );

    expect(whereNotQuery.getQuery()).toContain('"user"."id" != ');

    const otherUsers = await selectQuery.clone().select('user.id').getMany();

    const result = await whereNotQuery.select('user.id').getMany();
    expect(result).toHaveLength(otherUsers.length);
    expect(result.map((user) => user.id)).toEqual(
      otherUsers.map((user) => user.id),
    );
  });
});
