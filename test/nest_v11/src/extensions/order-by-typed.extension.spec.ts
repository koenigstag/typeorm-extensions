import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import 'typeorm-extensions/extensions/typed/typed-select/typed-select.extension';
import { KeyHolder } from 'typeorm-extensions/utils/proxy-key.utils';
import { createFakeUsers, mysqlRun, nativeSql, setupTest, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

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

  // TypeORM leaves keys of an alias without metadata as written, and PostgreSQL folds unquoted camelCase
  it('SHOULD quote keys of an alias without metadata unless useQuotes is false', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    type Joins = { userNames: { userId: number } };

    const fromSubQuery = () =>
      context.dataSource
        .createQueryBuilder()
        .from((qb) => qb.from(UserEntity, 'u').select('u.id', 'userId'), 'userNames');

    const query = fromSubQuery()
      .selectTyped<Joins>((j) => j.userNames.userId)
      .orderByTyped<Joins>((j) => j.userNames.userId, 'DESC');

    expect(sqlOf(query)).toMatch(/^SELECT "userNames"\."userId" FROM \(.+\) "userNames" ORDER BY "userNames"\."userId" DESC$/);

    const ids = (await query.getRawMany<{ userId: number }>()).map((row) => Number(row.userId));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(ids).toHaveLength(3);

    const unquoted = fromSubQuery().orderByTyped<Joins>((j) => j.userNames.userId, 'DESC', undefined, { useQuotes: false });
    expect(unquoted.expressionMap.orderBys).toEqual({ 'userNames.userId': 'DESC' });
  });

  it('SHOULD quote keys of an alias without metadata added after the call', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    type Joins = { userNames: { userId: number } };

    const query = context.dataSource
      .createQueryBuilder()
      .selectTyped<Joins>((j) => j.userNames.userId, 'userId')
      .orderByTyped<Joins>((j) => j.userNames.userId, 'DESC')
      .from((qb) => qb.from(UserEntity, 'u').select('u.id', 'userId'), 'userNames');

    expect(sqlOf(query)).toMatch(
      /^SELECT "userNames"\."userId" AS "userId" FROM \(.+\) "userNames" ORDER BY "userNames"\."userId" DESC$/,
    );

    const ids = (await query.getRawMany<{ userId: number }>()).map((row) => Number(row.userId));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(ids).toHaveLength(3);
  });

  // TypeORM reads a select of `alias.property` as a column of the joined entity and fills it
  it('SHOULD leave keys of an entity joined after the call to TypeORM', async () => {
    const [user] = await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 1 }));
    await context.dataSource.getRepository(ImageEntity).save(Object.assign(new ImageEntity(), { id: 1, url: 'a.png', userId: user.id }));
    type Joins = { user: UserEntity; image: ImageEntity };

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select('user.id')
      .addSelectTyped<Joins>((j) => [j.image.id, j.image.url])
      .addOrderByTyped<Joins>((j) => j.image.url, 'ASC')
      .leftJoin('user.images', 'image');

    expect(query.expressionMap.selects.map((select) => select.selection)).toEqual(['user.id', 'image.id', 'image.url']);
    expect(query.expressionMap.orderBys).toEqual({ 'image.url': 'ASC' });

    const [loaded] = await query.getMany();
    expect(loaded.images?.map((image) => image.url)).toEqual(['a.png']);
  });
});
