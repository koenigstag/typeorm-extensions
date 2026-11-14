import 'typeorm-extensions/extensions/typed/typed-select/typed-select.extension';
import { KeyHolder } from 'typeorm-extensions/utils/proxy-key.utils';
import { createFakeUsers, setupTest } from "../test-utils";
import { LegacyColumnsEntity, UserEntity } from "../models";
import { sqlOf } from '../test-utils';

setupTest('select-typed.where', undefined, (context) => {
  it('SHOULD read a KeyHolder like a callback: under the main alias, with the column name when quoted', async () => {
    const legacy = context.dataSource.getRepository(LegacyColumnsEntity);
    await legacy.save([new LegacyColumnsEntity({ firstName: 'Bob' }), new LegacyColumnsEntity({ firstName: 'Ann' })]);

    const quoted = legacy.createQueryBuilder('legacy').selectTyped(new KeyHolder(['firstName']), 'name', true);

    expect(sqlOf(quoted)).toContain('SELECT "legacy"."first-name" AS "name"');
    expect(await quoted.getRawMany()).toEqual([{ name: 'Bob' }, { name: 'Ann' }]);

    const mapped = legacy.createQueryBuilder('legacy').selectTyped([new KeyHolder(['firstName'])]);

    expect(sqlOf(mapped)).toContain('SELECT "legacy"."first-name" AS "legacy_first-name"');
  });

  it('SHOULD select single column correctly', async () => {
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

    const simpleSelectQuery = selectQuery.clone().select('user.id');
    const selectTypedQuery = selectQuery.clone().selectTyped((u) => u.id);

    expect(sqlOf(simpleSelectQuery)).toEqual(sqlOf(selectTypedQuery));
    expect(sqlOf(selectTypedQuery)).toContain('SELECT "user"."id" AS "user_id" FROM "users" "user"');

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.id).toBeDefined();
    expect(result[0]?.firstName).toBeUndefined();
  });

  it('SHOULD select several column correctly', async () => {
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


    const simpleSelectQuery = selectQuery.clone().select('user.id').addSelect('user.firstName');
    const selectTypedQuery = selectQuery.clone().selectTyped((u) => [u.id, u.firstName]);

    expect(sqlOf(simpleSelectQuery)).toEqual(sqlOf(selectTypedQuery));
    expect(sqlOf(selectTypedQuery)).toContain('SELECT "user"."id" AS "user_id", "user"."firstName" AS "user_firstName" FROM "users" "user"');

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(10);
    expect(result[0]?.id).toBeDefined();
    expect(result[0]?.firstName).toBeDefined();
    expect(result[0]?.lastName).toBeUndefined();
  });

  it('SHOULD select empty list if quotes are applied', async () => {
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

    const simpleSelectQuery = selectQuery.clone().select('"user"."id"');
    const selectTypedQuery = selectQuery.clone().selectTyped((u) => u.id, undefined, true);

    expect(sqlOf(simpleSelectQuery)).toEqual(sqlOf(selectTypedQuery));
    expect(sqlOf(selectTypedQuery)).toContain('SELECT "user"."id" FROM "users" "user"');

    const result = await selectTypedQuery.getMany();

    expect(result).toHaveLength(0);
    expect(result[0]?.id).toBeUndefined();
    expect(result[0]?.firstName).toBeUndefined();
  });
});