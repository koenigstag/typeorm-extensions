import 'typeorm-extensions/extensions/where-is-in.extension';
import 'typeorm-extensions/extensions/where-is-any.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { stringToSQLIdentifier } from 'typeorm-extensions/utils/sql.utils';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

describe('stringToSQLIdentifier', () => {
  it.each([
    ['id', '"id"'],
    ['user.id', '"user"."id"'],
    ['public.users.id', '"public"."users"."id"'],
    ['"user"."id"', '"user"."id"'],
    ['user."id"', '"user"."id"'],
    ['"my.table"."id"', '"my.table"."id"'],
    ['user.*', '"user".*'],
    ['"user".*', '"user".*'],
  ])('SHOULD quote identifier path %s', (input, expected) => {
    expect(stringToSQLIdentifier(input)).toBe(expected);
  });

  it.each([
    'COALESCE(ts."instructorId", e."instructorId")',
    'LOWER(u.email)',
    'u.id::text',
    '*',
    'first-name',
    'user.id = 1',
  ])('SHOULD leave expression %s as is', (input) => {
    expect(stringToSQLIdentifier(input)).toBe(input);
  });

  it('SHOULD use backticks for mysql', () => {
    expect(stringToSQLIdentifier('user.id', 'mysql')).toBe('`user`.`id`');
    expect(stringToSQLIdentifier('LOWER(u.email)', 'mysql')).toBe('LOWER(u.email)');
  });
});

setupTest('where-is-in.expressions', undefined, (context) => {
  const seed = async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const names = ['Alice', 'Bob', 'Carol'];

    return usersRepository.save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index],
          lastName: `${names[index]}son`,
        }),
      }),
    );
  };

  it('SHOULD keep a function expression as the IN operand', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .whereIsIn(nativeSql('COALESCE(u."firstName", u."lastName")'), ['Alice', 'Carol'])
      .orderBy('u.id', 'ASC');

    expect(sqlOf(query)).toContain(
      'WHERE COALESCE(u."firstName", u."lastName") IN (',
    );

    const result = await query.getMany();
    expect(result.map((user) => user.firstName)).toEqual(['Alice', 'Carol']);
  });

  it('SHOULD keep LOWER(...) as the IN operand', async () => {
    const users = await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .whereIsIn('LOWER(u.email)', [users[1].email.toLowerCase()]);

    expect(sqlOf(query)).not.toContain('"LOWER(');

    const result = await query.getMany();
    expect(result.map((user) => user.firstName)).toEqual(['Bob']);
  });

  it('SHOULD still quote identifier paths', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .whereIsIn('u.id', [1])
      .andWhereIsInTyped((u) => u.firstName, ['Alice']);

    expect(sqlOf(query)).toMatch(
      /WHERE "u"\."id" IN \(:\.\.\.where_\w+\) AND "u"\."firstName" IN/,
    );
  });

  it('SHOULD keep a ::cast as is (postgres)', async () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .whereIsAny('u.id::text', ['1']);

    expect(sqlOf(query)).toMatch(/WHERE u\.id::text = ANY\(:where_\w+\)/);

    if (postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      const users = await seed();

      const result = await context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('u')
        .whereIsAny('u.id::text', [String(users[2].id)])
        .getMany();

      expect(result.map((user) => user.firstName)).toEqual(['Carol']);
    }
  });
});
