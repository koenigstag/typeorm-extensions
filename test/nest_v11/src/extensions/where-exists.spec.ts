import 'typeorm-extensions/extensions/where-exists.extension';
import { Brackets, DeleteQueryBuilder, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { setupTest, createFakeUsers, nativeSql } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';

setupTest('whereNotExists', undefined, (context) => {
  // users 1–3; user 1 has an open ticket, user 2 a done one, user 3 none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
    ]);
  };

  const ticketsOfUser = (status: string) =>
    context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .where(`t.ownerId = ${nativeSql('"user"."id"')}`)
      .andWhere('t.status = :status', { status });

  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');

  const userIds = async (build: (query: ReturnType<typeof users>) => unknown) => {
    const query = users();
    build(query);

    return (await query.getMany()).map((user) => user.id);
  };

  it('SHOULD negate TypeORM whereExists on a select, with the parameters of the subquery', async () => {
    await seed();

    expect(await userIds((query) => query.andWhereExists(ticketsOfUser('open')))).toEqual([1]);
    expect(await userIds((query) => query.andWhereNotExists(ticketsOfUser('open')))).toEqual([2, 3]);
  });

  it('SHOULD keep TypeORM whereExists on a select and add its own to update and delete queries', () => {
    expect(SelectQueryBuilder.prototype.andWhereExists).not.toBe(UpdateQueryBuilder.prototype.andWhereExists);
    expect(UpdateQueryBuilder.prototype.andWhereExists).toBe(DeleteQueryBuilder.prototype.andWhereExists);
  });

  // both subqueries name their parameter `:status`
  it('SHOULD add NOT EXISTS inside Brackets, each subquery with its own parameter values', async () => {
    await seed();

    const ids = await userIds((query) =>
      query.andWhere(
        new Brackets((where) => where.whereNotExists(ticketsOfUser('open')).andWhereNotExists(ticketsOfUser('done'))),
      ),
    );

    expect(ids).toEqual([3]);
  });

  it('SHOULD add EXISTS and NOT EXISTS to update and delete queries', async () => {
    await seed();
    await context.dataSource.getRepository(TicketEntity).save(new TicketEntity({ status: 'open', ownerId: 99 }));

    const ownerOfTicket = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where(`${nativeSql('"user"."id"')} = ${nativeSql('"tickets"."owner_id"')}`);

    await context.dataSource
      .createQueryBuilder()
      .update(TicketEntity)
      .set({ status: 'orphan' })
      .whereNotExists(ownerOfTicket)
      .execute();

    await context.dataSource
      .createQueryBuilder()
      .delete()
      .from(TicketEntity)
      .whereExists(ownerOfTicket)
      .andWhere('ticket_status = :status', { status: 'done' })
      .execute();

    const tickets = await context.dataSource.getRepository(TicketEntity).find({ order: { id: 'ASC' } });

    expect(tickets.map(({ status, ownerId }) => [status, ownerId])).toEqual([
      ['open', 1],
      ['orphan', 99],
    ]);
  });
});
