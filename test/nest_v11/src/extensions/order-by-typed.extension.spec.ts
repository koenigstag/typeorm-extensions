import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import { createFakeUsers, setupTest } from '../test-utils';
import { UserEntity } from '../models';

setupTest('order-by-typed.orderByTyped', undefined, (context) => {
  it('SHOULD apply order by correctly', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
    });
    await usersRepository.save(fakeUsers);

    const orderByQuery = usersRepository
      .createQueryBuilder('user')
      .select('user.id')
      .addSelect('user.email')
      .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
      .orderByTyped((u) => u.email, 'ASC');

    const defaultOrderByQuery = usersRepository
      .createQueryBuilder('user')
      .select('user.id')
      .addSelect('user.email')
      .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
      .orderBy('user.email', 'ASC');

    expect(orderByQuery.getQuery()).toContain('ORDER BY "user_email" ASC');
    expect(orderByQuery.getQuery()).toEqual(defaultOrderByQuery.getQuery());

    const result = await orderByQuery.getMany();
    const users = await defaultOrderByQuery.getMany();

    expect(result).toHaveLength(fakeUsers.length);
    expect(result).toHaveLength(users.length);
    expect(result[0].email).toBeDefined();
    expect(result[0].email).toEqual(users[0].email);
  });

  it('SHOULD handle nulls first/last', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
    });
    await usersRepository.save(fakeUsers);

    const orderByQuery = usersRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
      .select('user.id')
      .addSelect('user.email')
      .orderByTyped((u) => u.id, 'DESC', 'NULLS FIRST');

    const defaultOrderByQuery = usersRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
      .select('user.id')
      .addSelect('user.email')
      .orderBy('user.id', 'DESC', 'NULLS FIRST');

    expect(orderByQuery.getQuery()).toContain(
      'ORDER BY "user_id" DESC NULLS FIRST',
    );
    expect(orderByQuery.getQuery()).toEqual(
      defaultOrderByQuery.getQuery(),
    );

    const result = await orderByQuery.getMany();
    const users = await defaultOrderByQuery.getMany();

    expect(result).toHaveLength(users.length);
    expect(result[0].id).toBeDefined();
    expect(result[0].id).toEqual(fakeUsers[9].id);
  });
});
