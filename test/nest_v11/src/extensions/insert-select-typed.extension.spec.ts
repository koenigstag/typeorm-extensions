import 'typeorm-extensions/extensions/typed/typed-on-conflict/typed-on-conflict.extension';
import 'typeorm-extensions/extensions/typed/typed-insert-select/typed-insert-select.extension';
import { setupTest } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

setupTest('insert-select-typed', undefined, (context) => {
  const tickets = () => context.dataSource.getRepository(TicketEntity);
  const users = () => context.dataSource.getRepository(UserEntity);
  const isPostgres = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);
  const isMySql = () => ['mysql', 'mariadb'].includes(context.typeormOptions.type);

  const seedUsers = () =>
    users().save([
      new UserEntity({ firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com' }),
      new UserEntity({ firstName: 'Bob', lastName: 'Ray', email: 'bob@example.com' }),
      new UserEntity({ firstName: 'Ann', lastName: 'Cho', email: 'ann.cho@example.com' }),
    ]);

  const ticketsOfAnns = () =>
    tickets()
      .createQueryBuilder()
      .insert()
      .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u').where('u.firstName = :name', { name: 'Ann' }), {
        ownerId: 'u.id',
        status: "'new'",
      });

  it('SHOULD put the select in place of VALUES, its columns in the order TypeORM lists them', () => {
    const [sql, parameters] = ticketsOfAnns().getQueryAndParameters();
    const q = (name: string) => (isMySql() ? `\`${name}\`` : `"${name}"`);

    expect(sql).toContain(`(${q('ticket_status')}, ${q('owner_id')}) SELECT ('new'), (${q('u')}.${q('id')}) FROM`);
    expect(sql).not.toContain('VALUES');
    expect(parameters).toEqual(['Ann']);
  });

  it('SHOULD insert a row for each row the select returns', async () => {
    const [ann, , annCho] = await seedUsers();

    await ticketsOfAnns().execute();

    const rows = await tickets().find({ order: { ownerId: 'ASC' } });

    expect(rows.map((row) => [row.ownerId, row.status])).toEqual([
      [ann.id, 'new'],
      [annCho.id, 'new'],
    ]);
  });

  it('SHOULD keep TypeORM writing the conflict clause around the select', async () => {
    if (isMySql()) {
      return;
    }

    await seedUsers();

    const copyUsers = () =>
      tickets()
        .createQueryBuilder()
        .insert()
        .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u'), { id: 'u.id', status: "'copied'", ownerId: 'u.id' })
        .onConflictTyped({ target: ['id'] });

    await copyUsers().execute();
    await copyUsers().execute();

    expect(await tickets().count()).toBe(3);
  });

  it('SHOULD return the inserted rows RETURNING names', async () => {
    if (!isPostgres()) {
      return;
    }

    await seedUsers();

    const result = await tickets()
      .createQueryBuilder()
      .insert()
      .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u').where('u.lastName = :lastName', { lastName: 'Ray' }), {
        status: "'returned'",
        ownerId: 'u.id',
      })
      .returning(['status'])
      .execute();

    expect(result.raw).toEqual([{ ticket_status: 'returned' }]);
  });

  it('SHOULD give the select parameters names of their own', () => {
    const sql = tickets()
      .createQueryBuilder()
      .insert()
      .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u').where('u.firstName = :name', { name: 'Ann' }), {
        status: ':name',
        ownerId: 'u.id',
      })
      .getQuery();

    const names = sql.match(/:name\w*/g);

    expect(names).toHaveLength(2);
    expect(names?.every((name) => /^:name_\w+$/.test(name))).toBe(true);
  });

  it('SHOULD refuse a property that is not an inserted column, and values() next to the select', () => {
    expect(() =>
      tickets()
        .createQueryBuilder()
        .insert()
        .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u'), { owner: 'u.id' } as never),
    ).toThrow('"owner" not an inserted column');

    expect(() =>
      tickets()
        .createQueryBuilder()
        .insert()
        .values({ status: 'x' })
        .valuesFromSelectTyped((sub) => sub.from(UserEntity, 'u'), { status: "'new'" }),
    ).toThrow('leave values() out');
  });
});
