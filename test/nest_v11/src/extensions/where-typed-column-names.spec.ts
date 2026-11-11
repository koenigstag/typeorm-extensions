import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-any.extension';
import 'typeorm-extensions/extensions/where-is-in.extension';
import { Brackets } from 'typeorm';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// TicketEntity: status → "ticket_status", ownerId → "owner_id", id → "ticket_id"
setupTest('where-typed.column-names', undefined, (context) => {
  const seed = async () => {
    const users = await context.dataSource
      .getRepository(UserEntity)
      .save(await createFakeUsers({ count: 2 }));

    const tickets = await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: users[0].id }),
      new TicketEntity({ status: 'closed', ownerId: users[0].id }),
      new TicketEntity({ status: 'open', ownerId: users[1].id }),
    ]);

    return { users, tickets };
  };

  const statuses = async () =>
    (
      await context.dataSource
        .getRepository(TicketEntity)
        .find({ order: { id: 'ASC' } })
    ).map((ticket) => ticket.status);

  it('SHOULD use database column names for the main alias', async () => {
    const { tickets } = await seed();

    const query = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .whereTyped((t) => t.status, '=', 'open')
      .andWhereIsInTyped((t) => t.id, [tickets[0].id, tickets[1].id])
      .andWhereIsNotInTyped((t) => t.ownerId, [-1]);

    expect(sqlOf(query)).toMatch(
      /WHERE "t"\."ticket_status" = :where_\w+ AND "t"\."ticket_id" IN \(.+\) AND "t"\."owner_id" NOT IN/,
    );

    const result = await query.getMany();
    expect(result.map((ticket) => ticket.id)).toEqual([tickets[0].id]);
  });

  it('SHOULD use database column names for a joined alias', async () => {
    const { users } = await seed();
    type Joins = { user: UserEntity; t: TicketEntity };

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .innerJoin(TicketEntity, 't', nativeSql('"t"."owner_id" = "user"."id"'))
      .whereTyped<Joins>((j) => j.t.status, '=', 'closed');

    expect(sqlOf(query)).toMatch(/WHERE "t"\."ticket_status" = :where_\w+/);

    const result = await query.getMany();
    expect(result.map((user) => user.id)).toEqual([users[0].id]);
  });

  // the builder of a Brackets callback has the main alias but no alias list: the aliases are on its parent
  it('SHOULD use database column names inside Brackets', async () => {
    const { users, tickets } = await seed();

    const main = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .where(
        new Brackets((where) =>
          where
            .whereTyped((t) => t.status, '=', 'open')
            .andWhere(new Brackets((nested) => nested.whereIsInTyped((t) => t.t.id, [tickets[0].id, tickets[1].id]))),
        ),
      );

    expect(sqlOf(main)).toMatch(/WHERE \("t"\."ticket_status" = :where_\w+ AND \("t"\."ticket_id" IN \(/);
    expect((await main.getMany()).map((ticket) => ticket.id)).toEqual([tickets[0].id]);

    type Joins = { user: UserEntity; t: TicketEntity };

    const joined = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .innerJoin(TicketEntity, 't', nativeSql('"t"."owner_id" = "user"."id"'))
      .where(new Brackets((where) => where.whereTyped<Joins>((j) => j.t.status, '=', 'closed')))
      .andWhere(new Brackets((where) => where.whereIsIn('t.status', ['closed'])));

    expect(sqlOf(joined)).toMatch(/WHERE \("t"\."ticket_status" = :where_\w+\) AND \("t"\."ticket_status" IN \(/);
    expect((await joined.getMany()).map((user) => user.id)).toEqual([users[0].id]);
  });

  it('SHOULD use database column names of the outer query in a subquery', () => {
    type Joins = { t: TicketEntity };

    const query = context.dataSource.getRepository(TicketEntity).createQueryBuilder('t');
    const subQuery = query
      .subQuery()
      .select('1')
      .from(UserEntity, 'user')
      .whereTyped<Joins>((j) => j.t.status, '=', 'open');

    expect(sqlOf(subQuery)).toMatch(/WHERE "t"\."ticket_status" = :where_\w+/);
  });

  it('SHOULD use database column names on UPDATE / DELETE', async () => {
    await seed();
    const repository = context.dataSource.getRepository(TicketEntity);

    const update = repository
      .createQueryBuilder()
      .update()
      .set({ status: 'archived' })
      .whereTyped((t) => t.status, '=', 'closed');

    expect(sqlOf(update)).toMatch(/WHERE "ticket_status" = :where_\w+$/);
    await update.execute();
    expect(await statuses()).toEqual(['open', 'archived', 'open']);

    const remove = repository
      .createQueryBuilder()
      .delete()
      .whereIsInTyped((t) => t.status, ['archived']);

    expect(sqlOf(remove)).toMatch(/WHERE "ticket_status" IN \(/);
    await remove.execute();
    expect(await statuses()).toEqual(['open', 'open']);
  });

  it('SHOULD use database column names in whereIsAnyTyped', async () => {
    const query = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .whereIsAnyTyped((t) => t.status, ['open']);

    expect(sqlOf(query)).toMatch(/WHERE "t"\."ticket_status" = ANY\(/);

    if (postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      await seed();
      expect(await query.getCount()).toBe(2);
    }
  });

  it('SHOULD fall back to the property name for an alias without metadata', () => {
    type Joins = { sub: { total: number } };

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoin(
        (qb) => qb.from(TicketEntity, 'x').select('COUNT(*)', 'total'),
        'sub',
        'TRUE',
      )
      .whereTyped<Joins>((j) => j.sub.total, '>', 0);

    expect(sqlOf(query)).toMatch(/WHERE "sub"\."total" > :where_\w+/);
  });
});
