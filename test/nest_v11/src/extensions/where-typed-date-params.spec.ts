import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

class EmailFilter {
  constructor(public email: string) {}
}

// Date (and Buffer) parameters used to be read as a params object: Object.values(date) is []
// so the condition became `> NULL`
setupTest('where-typed.date-params', undefined, (context) => {
  const queryUsers = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  it('SHOULD bind a Date as the value, not compare with NULL', () => {
    const since = new Date('2024-01-01T00:00:00.000Z');

    const [query, parameters] = queryUsers()
      .whereTyped((u) => u.createdAt, '>', since)
      .getQueryAndParameters();

    expect(query).not.toMatch(/NULL/);
    expect(query).toMatch(/WHERE "user"\."createdAt" > (\$1|\?)/);
    expect(parameters).toHaveLength(1);
    expect(String(parameters[0])).not.toBe('');
  });

  it('SHOULD bind a Date given in a params object', () => {
    const since = new Date('2024-01-01T00:00:00.000Z');

    const query = queryUsers().whereTyped((u) => u.createdAt, '>=', { since });

    expect(query.getQuery()).toMatch(/WHERE "user"\."createdAt" >= :where\w+/);
    expect(Object.values(query.getParameters())).toEqual([since]);
  });

  it('SHOULD bind a Buffer as the value', () => {
    const bytes = Buffer.from('ab');

    const query = queryUsers().whereTyped((u) => u.email, '=', bytes);

    expect(query.getQuery()).toMatch(/WHERE "user"\."email" = :where\w+/);
    expect(Object.values(query.getParameters())).toEqual([bytes]);
  });

  it('SHOULD compare an invalid Date with NULL, like NaN', () => {
    const query = queryUsers().whereTyped((u) => u.createdAt, '>', new Date('nope'));

    expect(query.getQuery()).toMatch(/WHERE "user"\."createdAt" > NULL/);
  });

  it('SHOULD still read named parameters from class instances', () => {
    const query = queryUsers().whereTyped(
      (u) => u.email,
      '= :email',
      new EmailFilter('a@b.c'),
    );

    expect(query.getQuery()).toMatch(/WHERE "user"\."email" = :email/);
    expect(query.getParameters()).toMatchObject({ email: 'a@b.c' });
  });

  it('SHOULD filter rows by a Date', async () => {
    const repository = context.dataSource.getRepository(UserEntity);
    const users = await repository.save(await createFakeUsers({ count: 3 }));
    const dates = ['2024-01-01', '2024-06-01', '2025-01-01'].map(
      (day) => new Date(`${day}T00:00:00.000Z`),
    );

    for (const [i, user] of users.entries()) {
      await repository
        .createQueryBuilder()
        .update()
        .set({ createdAt: dates[i] })
        .where('id = :id', { id: user.id })
        .execute();
    }

    const result = await queryUsers()
      .whereTyped((u) => u.createdAt, '>', new Date('2024-03-01T00:00:00.000Z'))
      .andWhereTyped((u) => u.createdAt, '<', new Date('2024-12-31T00:00:00.000Z'))
      .getMany();

    expect(result.map((user) => user.id)).toEqual([users[1].id]);
  });
});
