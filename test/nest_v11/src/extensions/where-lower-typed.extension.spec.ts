import 'typeorm-extensions/extensions/typed/typed-where/typed-where-lower.extension';
import { DataSource } from 'typeorm';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

const lowerTrim = (sql: string) => `LOWER(TRIM(${sql}))`;

// SQL generation only: the data source is never connected
const pg = () =>
  new DataSource({ type: 'postgres' }).createQueryBuilder().select('u.id').from('users', 'u');

const params = (query: { getQueryAndParameters(): [string, unknown[]] }) =>
  query.getQueryAndParameters()[1];

describe('where-lower-typed.sql', () => {
  it('SHOULD build `LOWER(column) = LOWER(:param)`', () => {
    const query = pg().whereLowerEqualsTyped<UserEntity>((u) => u.email, 'A@B.c');

    expect(query.getQuery()).toMatch(/WHERE LOWER\("u"\."email"\) = LOWER\(:where_\w+\)$/);
    expect(params(query)).toEqual(['A@B.c']);
  });

  it('SHOULD wrap both sides with normalize', () => {
    const query = pg()
      .whereLowerEqualsTyped<UserEntity>((u) => u.email, 'a')
      .orWhereLowerEqualsTyped<UserEntity>((u) => u.firstName, 'b', { normalize: lowerTrim });

    expect(query.getQuery()).toMatch(
      /WHERE LOWER\("u"\."email"\) = LOWER\(:where_\w+\) OR LOWER\(TRIM\("u"\."firstName"\)\) = LOWER\(TRIM\(:orWhere_\w+\)\)$/,
    );
  });

  it('SHOULD build `LOWER(column) IN (LOWER(:p0), LOWER(:p1))` with one parameter per value', () => {
    const emails = ['A@b.c', 'd@E.f'] as const;
    const query = pg()
      .where('u.id > 0')
      .andWhereIsInLowerTyped<UserEntity>((u) => u.email, emails, { normalize: lowerTrim });

    expect(query.getQuery()).toMatch(
      /WHERE u\.id > 0 AND LOWER\(TRIM\("u"\."email"\)\) IN \(LOWER\(TRIM\(:(andWhere_\w+)_0\)\), LOWER\(TRIM\(:\1_1\)\)\)$/,
    );
    expect(params(query)).toEqual(['A@b.c', 'd@E.f']);
  });

  it('SHOULD match nothing for a missing value or an empty list', () => {
    expect(pg().whereLowerEqualsTyped<UserEntity>((u) => u.email, null).getQuery()).toMatch(/WHERE FALSE$/);
    expect(pg().whereLowerEqualsTyped<UserEntity>((u) => u.email, undefined).getQuery()).toMatch(/WHERE FALSE$/);
    expect(pg().whereIsInLowerTyped<UserEntity>((u) => u.email, []).getQuery()).toMatch(/WHERE FALSE$/);
    expect(pg().whereIsInLowerTyped<UserEntity>((u) => u.email, null).getQuery()).toMatch(/WHERE FALSE$/);
  });

  it('SHOULD throw for a normalize that drops its argument, or invalid values', () => {
    expect(() =>
      pg().whereLowerEqualsTyped<UserEntity>((u) => u.email, 'a', { normalize: () => 'LOWER(email)' }),
    ).toThrow(/options\.normalize must return an SQL expression containing its argument/);
    expect(() =>
      pg().whereLowerEqualsTyped<UserEntity>((u) => u.email, 'a', { normalize: 'LOWER' as never }),
    ).toThrow(/options\.normalize to be a function/);
    expect(() => pg().whereIsInLowerTyped<UserEntity>((u) => u.email, 'a' as never)).toThrow(
      /whereIsInLowerTyped expects an array of values/,
    );
    expect(() => pg().whereLowerEqualsTyped<UserEntity>((u) => [u.email, u.firstName], 'a')).toThrow(
      /single column, got 2/,
    );
  });
});

setupTest('where-lower-typed', undefined, (context) => {
  const emails = ['Alice@Example.com', ' bob@example.com ', 'carol@EXAMPLE.com'];

  const seed = async () =>
    context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: emails.length,
        getOverrides: (index) => ({ email: emails[index], firstName: ['Alice', 'Bob', 'Carol'][index] }),
      }),
    );

  const firstNames = (query: { getMany(): Promise<UserEntity[]> }) =>
    query.getMany().then((users) => users.map((user) => user.firstName));

  const usersQuery = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id', 'ASC');

  it('SHOULD compare case-insensitively', async () => {
    await seed();

    expect(await firstNames(usersQuery().whereLowerEqualsTyped((u) => u.email, 'ALICE@example.COM'))).toEqual([
      'Alice',
    ]);
    // the stored value has spaces: only LOWER(TRIM(…)) finds it
    expect(await firstNames(usersQuery().whereLowerEqualsTyped((u) => u.email, 'BOB@example.com'))).toEqual([]);
    expect(
      await firstNames(
        usersQuery().whereLowerEqualsTyped((u) => u.email, ' BOB@example.com', { normalize: lowerTrim }),
      ),
    ).toEqual(['Bob']);
  });

  it('SHOULD match a list case-insensitively', async () => {
    await seed();

    expect(
      await firstNames(
        usersQuery().whereIsInLowerTyped((u) => u.email, ['carol@example.com', 'BOB@EXAMPLE.COM', 'x@y.z'], {
          normalize: lowerTrim,
        }),
      ),
    ).toEqual(['Bob', 'Carol']);
  });

  it('SHOULD not qualify the column on UpdateQueryBuilder', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update()
      .set({ lastName: 'Updated' })
      .whereLowerEqualsTyped((u) => u.email, 'CAROL@example.com');

    expect(query.getQuery()).toMatch(/WHERE LOWER\("email"\) = LOWER\(:where_\w+\)$/);
    expect((await query.execute()).affected).toBe(1);
  });
});

setupTest('where-lower-typed.postgres-index', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const plan = async (sql: string, parameters: unknown[]) =>
    JSON.stringify(
      await context.dataSource.transaction(async (manager) => {
        // the entity orders by id, so rule out the primary key index scan too
        await manager.query('SET LOCAL enable_seqscan = off');
        await manager.query('SET LOCAL enable_indexscan = off');
        return manager.query(`EXPLAIN (COSTS OFF) ${sql}`, parameters);
      }),
    );

  it('SHOULD use an expression index written the same way', async () => {
    await context.dataSource.query(
      'CREATE INDEX users_email_lower_trim ON users (LOWER(TRIM("email")))',
    );

    const repository = context.dataSource.getRepository(UserEntity);

    expect(
      await plan(
        ...repository
          .createQueryBuilder('user')
          .whereLowerEqualsTyped((u) => u.email, 'a@b.c', { normalize: lowerTrim })
          .getQueryAndParameters(),
      ),
    ).toMatch(/Bitmap Index Scan on users_email_lower_trim/);

    expect(
      await plan(
        ...repository
          .createQueryBuilder('user')
          .whereIsInLowerTyped((u) => u.email, ['a@b.c', 'd@e.f'], { normalize: lowerTrim })
          .getQueryAndParameters(),
      ),
    ).toMatch(/Bitmap Index Scan on users_email_lower_trim/);
  });
});
