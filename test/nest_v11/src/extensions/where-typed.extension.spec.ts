import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { setupTest, createFakeUsers, createRandomId, sqlOf } from '../test-utils';
import { UserEntity } from '../models';
import { selectElements } from '../utils';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';

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

    expect(sqlOf(whereInQuery)).toContain('"user"."id" IN (');

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

    expect(sqlOf(whereInQuery)).toContain('"user"."id" IN (');

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

    expect(sqlOf(whereQuery)).toContain('"user"."id" = ');

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

    expect(sqlOf(whereInQuery)).toContain('"user"."id" NOT IN (');

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

    expect(sqlOf(whereInQuery)).toContain('"user"."id" NOT IN (');

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

    expect(sqlOf(whereNotQuery)).toContain('"user"."id" != ');

    const otherUsers = await selectQuery.clone().select('user.id').getMany();

    const result = await whereNotQuery.select('user.id').getMany();
    expect(result).toHaveLength(otherUsers.length);
    expect(result.map((user) => user.id)).toEqual(
      otherUsers.map((user) => user.id),
    );
  });
});

setupTest('where-typed.jsonPath', undefined, (context) => {
  const t = tableHelper<UserEntity>('user');

  it('SHOULD generate correct SQL with jsonPath in conditions', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const selectQuery = usersRepository.createQueryBuilder('user');

    const whereQuery = selectQuery.clone().whereTyped(
      (u) => u.metadata,
      `${t.jsonPath('metadata', '->>', 'role')} =`,
      'admin',
    );

    expect(sqlOf(whereQuery)).toContain(
      '"user"."metadata" ->> \'role\' =',
    );
  });

  it('SHOULD generate correct SQL with nested jsonPath', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const selectQuery = usersRepository.createQueryBuilder('user');

    const whereQuery = selectQuery.clone().whereTyped(
      (u) => u.metadata,
      `${t.jsonPath('metadata', '->>', 'settings', 'theme')} =`,
      'light',
    );

    expect(sqlOf(whereQuery)).toContain(
      '"user"."metadata" -> \'settings\' ->> \'theme\' =',
    );
  });

  it('SHOULD work with andWhereTyped and jsonPath', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    let fakeUsers = await createFakeUsers({ count: 5 });
    fakeUsers = await usersRepository.save(fakeUsers);

    const selectQuery = usersRepository.createQueryBuilder('user');

    const whereQuery = selectQuery.clone()
      .whereTyped((u) => u.id, '=', fakeUsers[0].id)
      .andWhereTyped(
        (u) => u.metadata,
        `${t.jsonPath('metadata', '->>', 'role')} =`,
        'admin',
      );

    const query = sqlOf(whereQuery);
    expect(query).toContain('"user"."id" =');
    expect(query).toContain('"user"."metadata" ->> \'role\' =');
  });

  it('SHOULD work with -> operator for JSON object extraction', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const selectQuery = usersRepository.createQueryBuilder('user');

    const whereQuery = selectQuery.clone().whereTyped(
      (u) => u.metadata,
      `${t.jsonPath('metadata', '->', 'settings')} @> '{"theme": "dark"}'`,
    );

    expect(sqlOf(whereQuery)).toContain(
      '"user"."metadata" -> \'settings\' @> \'{"theme": "dark"}\'',
    );
  });
});

setupTest('where-typed.addValue', undefined, (context) => {
  it('SHOULD not append a placeholder WHEN condition already references a params key', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    let fakeUsers = await createFakeUsers({ count: 3 });
    fakeUsers = await usersRepository.save(fakeUsers);

    const whereQuery = usersRepository
      .createQueryBuilder('user')
      .whereTyped((u) => u.id, '= :id', { id: fakeUsers[1].id });

    expect(sqlOf(whereQuery)).toMatch(/"user"\."id" = :id(?: |$)/);

    const result = await whereQuery.getMany();
    expect(result.map((user) => user.id)).toEqual([fakeUsers[1].id]);
  });

  it('SHOULD not append a placeholder WHEN condition references a params key as an array', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    let fakeUsers = await createFakeUsers({ count: 4 });
    fakeUsers = await usersRepository.save(fakeUsers);
    const ids = [fakeUsers[0].id, fakeUsers[2].id];

    const whereQuery = usersRepository
      .createQueryBuilder('user')
      .whereTyped((u) => u.id, 'IN (:...ids)', { ids })
      .orderBy('user.id', 'ASC');

    expect(sqlOf(whereQuery)).toContain('"user"."id" IN (:...ids)');

    const result = await whereQuery.getMany();
    expect(result.map((user) => user.id)).toEqual(ids);
  });

  it('SHOULD still append a placeholder WHEN params key is not referenced in condition', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    let fakeUsers = await createFakeUsers({ count: 3 });
    fakeUsers = await usersRepository.save(fakeUsers);

    const whereQuery = usersRepository
      .createQueryBuilder('user')
      .whereTyped((u) => u.id, '=', { id: fakeUsers[2].id });

    expect(sqlOf(whereQuery)).toMatch(/"user"\."id" = :where_\w+(?: |$)/);

    const result = await whereQuery.getMany();
    expect(result.map((user) => user.id)).toEqual([fakeUsers[2].id]);
  });

  it('SHOULD still append a placeholder WHEN condition contains a ::cast', () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    const whereQuery = usersRepository
      .createQueryBuilder('user')
      .whereTyped((u) => u.firstName, '::text =', 'John');

    expect(sqlOf(whereQuery)).toMatch(
      /"user"\."firstName" ::text = :where_\w+(?: |$)/,
    );
  });

  it('SHOULD respect explicit addValue: false', () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);

    const whereQuery = usersRepository
      .createQueryBuilder('user')
      .whereTyped((u) => u.firstName, 'LIKE :search', { search: '%Jo%' }, {
        addValue: false,
      });

    expect(sqlOf(whereQuery)).toMatch(/"user"\."firstName" LIKE :search(?: |$)/);
  });
});
