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

    const selectQuery = usersRepository.createQueryBuilder('user');
    const orderByQuery = selectQuery.orderByTyped((u) => u.email, 'ASC');

    expect(orderByQuery.getQuery()).toContain('ORDER BY "user"."email" ASC');

    const result = await orderByQuery.getMany();

    expect(result).toHaveLength(fakeUsers.length);
    expect(result[0].email).toBeDefined();
    expect(result[0].email).toEqual(fakeUsers[0].email);
  });

  it('SHOULD handle nulls first/last', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    // seed 10 users
    const fakeUsers = await createFakeUsers({
      count: 10,
    });
    await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');
    const orderByQuery = selectQuery.orderByTyped(
      (u) => u.email,
      'DESC',
      'NULLS FIRST',
    );

    expect(orderByQuery.getQuery()).toContain('ORDER BY "user"."email" DESC NULLS FIRST');

    const result = await orderByQuery.getMany();

    expect(result).toHaveLength(fakeUsers.length);
    expect(result[0].email).toBeDefined();
    expect(result[0].email).toEqual(fakeUsers[9].email);
  });
});
