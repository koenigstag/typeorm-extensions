import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import { KeyHolder } from 'typeorm-extensions/utils/proxy-key.utils';
import { createFakeUsers, mysqlRun, nativeSql, setupTest, sqlOf } from '../test-utils';
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

    // newer TypeORM orders by the select alias ("user_email"), 0.3.12 by the column ("user"."email")
    expect(sqlOf(orderByQuery)).toMatch(/ORDER BY ("user_email"|"user"\."email") ASC/);
    expect(sqlOf(orderByQuery)).toEqual(sqlOf(defaultOrderByQuery));

    const result = await orderByQuery.getMany();
    const users = await defaultOrderByQuery.getMany();

    expect(result).toHaveLength(fakeUsers.length);
    expect(result).toHaveLength(users.length);
    expect(result[0].email).toBeDefined();
    expect(result[0].email).toEqual(users[0].email);
  });

  // MySQL has no NULLS FIRST / LAST
  (mysqlRun ? it.skip : it)('SHOULD handle nulls first/last', async () => {
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

    expect(sqlOf(orderByQuery)).toMatch(/ORDER BY ("user_id"|"user"\."id") DESC NULLS FIRST/);
    expect(sqlOf(orderByQuery)).toEqual(
      sqlOf(defaultOrderByQuery),
    );

    const result = await orderByQuery.getMany();
    const users = await defaultOrderByQuery.getMany();

    expect(result).toHaveLength(users.length);
    expect(result[0].id).toBeDefined();
    expect(result[0].id).toEqual(fakeUsers[9].id);
  });

  it('SHOULD accept TypedOrderByOptions in orderByTyped and addOrderByTyped', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderByTyped((u) => u.lastName, 'ASC', undefined, { useQuotes: true })
      .addOrderByTyped((u) => u.firstName, 'DESC', 'NULLS LAST', { useQuotes: true });

    expect(query.expressionMap.orderBys).toEqual({
      [nativeSql('"user"."lastName"')]: 'ASC',
      [nativeSql('"user"."firstName"')]: { order: 'DESC', nulls: 'NULLS LAST' },
    });
  });

  it('SHOULD apply useQuotes to a KeyHolder', () => {
    const holder = new KeyHolder(['user', 'email']);
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderByTyped(holder as never, 'ASC', undefined, { useQuotes: true })
      .addOrderByTyped(new KeyHolder(['user', 'id']) as never, 'DESC');

    expect(query.expressionMap.orderBys).toEqual({
      [nativeSql('"user"."email"')]: 'ASC',
      'user.id': 'DESC',
    });
  });
});
