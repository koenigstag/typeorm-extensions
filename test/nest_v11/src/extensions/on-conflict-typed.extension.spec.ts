import 'typeorm-extensions/extensions/typed/typed-on-conflict/typed-on-conflict.extension';
import { setupTest } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';
import { Sql } from 'typeorm-extensions/utils/sql-functions.utils';

setupTest('on-conflict-typed', undefined, (context) => {
  const tickets = () => context.dataSource.getRepository(TicketEntity);
  const isPostgres = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);
  const isMySql = () => ['mysql', 'mariadb'].includes(context.typeormOptions.type);

  const upsert = (values: Partial<TicketEntity>) =>
    tickets()
      .createQueryBuilder()
      .insert()
      .values(values)
      .onConflictTyped({
        target: ['id'],
        set: ({ excluded, current }) => ({ status: excluded.status, ownerId: `${current.ownerId} + 1` }),
        where: ({ current }) => `${current.status} = 'new'`,
      });

  it('SHOULD write the database names of the target, the set columns, the proposed and the existing row', () => {
    if (isMySql()) {
      return;
    }

    // TypeORM inserts into "tickets" AS "TicketEntity" on PostgreSQL, so the existing row goes by the alias there
    const current = isPostgres() ? '"TicketEntity"' : '"tickets"';

    expect(upsert({ id: 1, status: 'done' }).getQuery()).toContain(
      ` ON CONFLICT ("ticket_id") DO UPDATE SET "ticket_status" = EXCLUDED."ticket_status", "owner_id" = ${current}."owner_id" + 1 WHERE ${current}."ticket_status" = 'new'`,
    );
    expect(
      tickets()
        .createQueryBuilder()
        .insert()
        .values({ id: 1, status: 'done' })
        .onConflictTyped({ target: ['status'], targetWhere: (t) => `${t.ownerId} IS NULL` })
        .getQuery(),
    ).toContain(' ON CONFLICT ("ticket_status") WHERE "owner_id" IS NULL DO NOTHING');
  });

  const users = () => context.dataSource.getRepository(UserEntity);
  const upsertUser = (values: Pick<UserEntity, 'firstName' | 'email'>) =>
    users()
      .createQueryBuilder()
      .insert()
      .values({ lastName: 'Lee', ...values })
      .onConflictTyped({
        target: ['email'],
        set: ({ excluded, current }) => ({ firstName: excluded.firstName, lastName: `${current.lastName} || '!'` }),
        where: ({ current }) => `${current.firstName} = 'Ann'`,
      });

  it('SHOULD update the existing row only where the condition holds, and do nothing without set', async () => {
    if (isMySql()) {
      return;
    }

    await users().save(new UserEntity({ firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com' }));

    await upsertUser({ firstName: 'Bea', email: 'ann@example.com' }).execute();
    expect(await users().findOneByOrFail({ email: 'ann@example.com' })).toMatchObject({ firstName: 'Bea', lastName: 'Lee!' });

    // the existing row isn't Ann any more
    await upsertUser({ firstName: 'Cid', email: 'ann@example.com' }).execute();
    expect(await users().findOneByOrFail({ email: 'ann@example.com' })).toMatchObject({ firstName: 'Bea', lastName: 'Lee!' });

    await users()
      .createQueryBuilder()
      .insert()
      .values({ firstName: 'Dan', lastName: 'Lee', email: 'ann@example.com' })
      .onConflictTyped({ target: ['email'] })
      .execute();
    expect(await users().count()).toBe(1);
  });

  it('SHOULD take the proposed and the existing columns as Sql helper arguments', async () => {
    if (isMySql()) {
      return;
    }

    await users().save(new UserEntity({ firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com' }));

    // an empty proposed last name keeps the existing one
    await users()
      .createQueryBuilder()
      .insert()
      .values({ firstName: 'Bea', lastName: '', email: 'ann@example.com' })
      .onConflictTyped({
        target: ['email'],
        set: ({ excluded, current }) => ({
          firstName: excluded.firstName,
          lastName: Sql.coalesce(Sql.nullif(excluded.lastName, "''"), current.lastName),
        }),
      })
      .execute();

    expect(await users().findOneByOrFail({ email: 'ann@example.com' })).toMatchObject({ firstName: 'Bea', lastName: 'Lee' });
  });

  it('SHOULD return the columns of the written row after the clause', async () => {
    if (!isPostgres()) {
      return;
    }

    await users().save(new UserEntity({ firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com' }));

    const { raw } = await upsertUser({ firstName: 'Bea', email: 'ann@example.com' }).returning(['firstName']).execute();
    expect(raw).toEqual([expect.objectContaining({ firstName: 'Bea' })]);
  });

  it('SHOULD throw for a property that is no column, set without a target, where without set, and on MySQL', () => {
    const insert = () => tickets().createQueryBuilder().insert().values({ id: 1, status: 'done' });

    if (isMySql()) {
      expect(() => insert().onConflictTyped({ target: ['id'] })).toThrow(/supported on PostgreSQL and SQLite only/);

      return;
    }

    expect(() =>
      insert().onConflictTyped({ target: ['nope' as 'id'], set: ({ excluded }) => ({ status: excluded.status }) }),
    ).toThrow(/"nope" is not a column of TicketEntity/);
    expect(() => insert().onConflictTyped({ set: ({ excluded }) => ({ status: excluded.status }) })).toThrow(
      /set needs a target/,
    );
    expect(() => insert().onConflictTyped({ target: ['id'], where: () => 'TRUE' })).toThrow(/where applies to set/);
    expect(() => insert().onConflictTyped({ target: ['id'], set: () => ({}) })).toThrow(/set at least one column/);
  });
});
