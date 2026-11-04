import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-any.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// UPDATE / DELETE render `UPDATE "users" … WHERE …` without an alias,
// so typed keys must be bare columns there
setupTest('where-typed.update-delete', undefined, (context) => {
  const seed = async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const names = ['Alice', 'Bob', 'Carol'];

    return usersRepository.save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({ firstName: names[index] }),
      }),
    );
  };

  const firstNames = async () =>
    (
      await context.dataSource
        .getRepository(UserEntity)
        .find({ order: { id: 'ASC' } })
    ).map((user) => `${user.firstName}:${user.lastName}`);

  it('SHOULD not qualify typed keys with the alias on UpdateQueryBuilder', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update()
      .set({ lastName: 'Updated' })
      .whereTyped((u) => u.firstName, '=', 'Bob');

    expect(query.getQuery()).toMatch(/WHERE "firstName" = :where_\w+$/);

    const result = await query.execute();
    expect(result.affected).toBe(1);
    expect((await firstNames()).filter((n) => n.endsWith(':Updated'))).toEqual([
      'Bob:Updated',
    ]);
  });

  it('SHOULD not qualify typed keys with the alias on DeleteQueryBuilder', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .delete()
      .whereIsInTyped((u) => u.firstName, ['Alice', 'Carol'])
      .orWhereTyped((u) => u.firstName, 'IS NULL');

    expect(query.getQuery()).toMatch(
      /WHERE "firstName" IN \(:\.\.\.where_\w+\) OR "firstName" IS NULL$/,
    );

    await query.execute();
    expect((await firstNames()).map((n) => n.split(':')[0])).toEqual(['Bob']);
  });

  it('SHOULD not qualify typed keys with the alias in whereIsAnyTyped', async () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .whereIsAnyTyped((u) => u.id, [1, 2]);

    expect(query.getQuery()).toMatch(/WHERE "id" = ANY\(:where_\w+\)$/);

    if (postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      const users = await seed();

      await context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder()
        .delete()
        .whereIsAnyTyped((u) => u.id, [users[0].id, users[1].id])
        .execute();

      expect((await firstNames()).map((n) => n.split(':')[0])).toEqual(['Carol']);
    }
  });

  it('SHOULD drop the main alias from alias.column keys on UPDATE / DELETE', async () => {
    await seed();

    // `u.user.firstName` names the main alias `user`, which UPDATE doesn't render
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .update()
      .set({ lastName: 'Updated' })
      .whereTyped<{ user: UserEntity }>((u) => u.user.firstName, '=', 'Carol');

    expect(query.getQuery()).toMatch(/WHERE "firstName" = :where_\w+$/);

    const result = await query.execute();
    expect(result.affected).toBe(1);
    expect((await firstNames()).filter((n) => n.endsWith(':Updated'))).toEqual([
      'Carol:Updated',
    ]);
  });

  it('SHOULD keep qualifying typed keys on SelectQueryBuilder', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereTyped((u) => u.firstName, '=', 'Bob')
      .andWhereIsInTyped((u) => u.id, [1]);

    expect(query.getQuery()).toMatch(
      /WHERE "user"\."firstName" = :where_\w+ AND "user"\."id" IN/,
    );
  });
});
