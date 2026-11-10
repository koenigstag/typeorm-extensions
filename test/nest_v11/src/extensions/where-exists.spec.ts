import 'typeorm-extensions/extensions/where-exists.extension';
import {
  Brackets,
  Column,
  DeleteDateColumn,
  DeleteQueryBuilder,
  Entity,
  PrimaryGeneratedColumn,
  SelectQueryBuilder,
  UpdateQueryBuilder,
} from 'typeorm';
import { setupTest, createFakeUsers, nativeSql } from '../test-utils';
import { ImageEntity, TicketEntity, UserEntity } from '../models';

@Entity({ name: 'wx_notes' })
class NoteEntity {
  constructor(partial: Partial<NoteEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'integer', name: 'owner_id' })
  public ownerId: number;

  @DeleteDateColumn({ name: 'deleted_at' })
  public deletedAt?: Date | null;
}

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

  it('SHOULD keep the GROUP BY of a subquery with HAVING', async () => {
    await seed();
    await context.dataSource
      .getRepository(TicketEntity)
      .save([new TicketEntity({ status: 'done', ownerId: 1 }), new TicketEntity({ status: 'done', ownerId: 2 })]);

    // users with two tickets of one status: only user 2; user 1 has two of different statuses
    const repeatedStatus = (owner = '"user"."id"') =>
      context.dataSource
        .getRepository(TicketEntity)
        .createQueryBuilder('t')
        .where(`t.ownerId = ${nativeSql(owner)}`)
        .groupBy('t.status')
        .having('COUNT(*) > :times', { times: 1 });

    expect(await userIds((query) => query.andWhereNotExists(repeatedStatus()))).toEqual([1, 3]);

    const updated = await context.dataSource
      .createQueryBuilder()
      .update(UserEntity)
      .set({ firstName: 'repeated' })
      .whereExists(repeatedStatus('"users"."id"'))
      .execute();

    expect(updated.affected).toBe(1);
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

setupTest('whereNotExists on soft delete', { entities: [UserEntity, ImageEntity, NoteEntity] }, (context) => {
  it('SHOULD add NOT EXISTS to a soft delete query, inside Brackets too', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 1 }));
    await context.dataSource.getRepository(NoteEntity).save([new NoteEntity({ ownerId: 1 }), new NoteEntity({ ownerId: 99 })]);

    const owner = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where(`${nativeSql('"user"."id"')} = ${nativeSql('"wx_notes"."owner_id"')}`);

    await context.dataSource
      .createQueryBuilder()
      .softDelete()
      .from(NoteEntity)
      .where(new Brackets((where) => where.whereNotExists(owner)))
      .execute();

    const kept = await context.dataSource.getRepository(NoteEntity).find({ order: { id: 'ASC' } });

    expect(kept.map(({ ownerId }) => ownerId)).toEqual([1]);
  });
});
