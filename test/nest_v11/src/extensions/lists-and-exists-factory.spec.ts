import { Brackets } from 'typeorm';
import 'typeorm-extensions/extensions/where-exists.extension';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { postgresLikeDrivers } from '../constants/database';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';

const t = tableHelper<TicketEntity>('t');

describe('tableHelper value lists', () => {
  it('SHOULD write IN / NOT IN / ANY / ALL with the parameter it is given, and a constant for no values', () => {
    expect(t.isIn('status', ['open'], 'statuses')).toBe('"t"."status" IN (:...statuses)');
    expect(t.isNotIn('status', ['open'], 'statuses')).toBe('"t"."status" NOT IN (:...statuses)');
    expect(t.isAny('ownerId', [1], 'owners', 'int[]')).toBe('"t"."ownerId" = ANY(CAST(:owners AS int[]))');
    expect(t.isNotAny('ownerId', [1], 'owners')).toBe('"t"."ownerId" <> ALL(:owners)');

    expect([t.isIn('status', [], 's'), t.isAny('status', null, 's'), t.isNotIn('status', undefined, 's'), t.isNotAny('status', [], 's')]).toEqual([
      'FALSE',
      'FALSE',
      'TRUE',
      'TRUE',
    ]);
  });

  it('SHOULD refuse a parameter name or an array type that could carry SQL, and values that are not a list', () => {
    expect(() => t.isIn('status', ['open'], 'ids) OR (1=1')).toThrow(TypeError);
    expect(() => t.isAny('status', ['open'], 'ids', 'text[]); DROP TABLE x; --')).toThrow(TypeError);
    expect(() => t.isIn('status', new Set(['open']) as never, 'ids')).toThrow(TypeError);
  });
});

setupTest('tableHelper value lists in queries', undefined, (context) => {
  const tickets = () => context.dataSource.getRepository(TicketEntity).createQueryBuilder('t').orderBy('t.id');
  const statuses = async (query: ReturnType<typeof tickets>) => (await query.getMany()).map((ticket) => ticket.status);

  it('SHOULD match the rows of the bound list, and none or all for an empty one', async () => {
    await context.dataSource
      .getRepository(TicketEntity)
      .save([new TicketEntity({ status: 'open', ownerId: 1 }), new TicketEntity({ status: 'done', ownerId: 2 })]);

    const own = tableHelper(TicketEntity, 't', { driver: context.typeormOptions.type });

    expect(await statuses(tickets().where(own.isIn('status', ['open'], 'wanted'), { wanted: ['open'] }))).toEqual(['open']);
    expect(await statuses(tickets().where(own.isNotIn('status', ['open'], 'unwanted'), { unwanted: ['open'] }))).toEqual(['done']);
    expect(await statuses(tickets().where(own.isIn('status', [], 'wanted')))).toEqual([]);
    expect(await statuses(tickets().where(own.isNotIn('status', [], 'unwanted')))).toEqual(['open', 'done']);

    if (postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      expect(await statuses(tickets().where(own.isAny('ownerId', [2], 'owners', 'int[]'), { owners: [2] }))).toEqual(['done']);
      expect(await statuses(tickets().where(own.isNotAny('ownerId', [2], 'owners'), { owners: [2] }))).toEqual(['open']);
    }
  });
});

setupTest('whereExists with a factory', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');
  const ids = async (query: ReturnType<typeof users>) => (await query.getMany()).map((user) => user.id);
  const ownTickets = (status: string) => (sub: ReturnType<typeof users>) =>
    sub
      .select('1')
      .from(TicketEntity, 'ticket')
      .where(`ticket.ownerId = ${nativeSql('"user"."id"')}`)
      .andWhere('ticket.status = :status', { status });

  // users 1–3; user 1 has an open ticket, user 2 a done one, user 3 none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
    ]);
  };

  it('SHOULD build the subquery a factory returns, on select, keeping TypeORM\'s method for a builder', async () => {
    await seed();

    expect(await ids(users().andWhereExists(ownTickets('open') as never))).toEqual([1]);
    expect(await ids(users().andWhereNotExists(ownTickets('open') as never))).toEqual([2, 3]);
    expect(sqlOf(users().whereExists(ownTickets('open') as never))).toMatch(/WHERE EXISTS \(SELECT 1 FROM/);

    const builder = context.dataSource.createQueryBuilder().select('1').from(TicketEntity, 'ticket').where(`ticket.ownerId = ${nativeSql('"user"."id"')}`);
    expect(await ids(users().andWhereExists(builder))).toEqual([1, 2]);
  });

  it('SHOULD keep the parameters of two factories apart', async () => {
    await seed();

    const query = users().andWhereNotExists(ownTickets('open') as never).andWhereNotExists(ownTickets('done') as never);

    expect(await ids(query)).toEqual([3]);
    expect(Object.values(query.getParameters()).sort()).toEqual(['done', 'open']);
  });

  it('SHOULD write existsSql / notExistsSql into an OR group, Brackets, a selection and an ordering', async () => {
    await seed();

    const openOrSecond = users().where((qb) => `(${qb.existsSql(ownTickets('open') as never)} OR user.id = :second)`, { second: 2 });
    expect(await ids(openOrSecond)).toEqual([1, 2]);

    const withoutOpen = users().where(new Brackets((qb) => qb.where(qb.notExistsSql(ownTickets('open') as never)).andWhere('user.id <> :third', { third: 3 })));
    expect(await ids(withoutOpen)).toEqual([2]);

    const flagged = users();
    const rows = await flagged
      .select('user.id', 'id')
      .addSelect(flagged.existsSql(ownTickets('done') as never), 'hasDone')
      .getRawMany<{ id: number; hasDone: unknown }>();
    expect(rows.map((row) => [Number(row.id), Number(row.hasDone) === 1 || row.hasDone === true])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);

    const ordered = context.dataSource.getRepository(UserEntity).createQueryBuilder('user');
    ordered.orderBy(`CASE WHEN ${ordered.existsSql(ownTickets('done') as never)} THEN 0 ELSE 1 END`, 'ASC').addOrderBy('user.id', 'ASC');
    expect((await ordered.getMany()).map((user) => user.id)).toEqual([2, 1, 3]);
  });

  it('SHOULD keep the parameters of two existsSql calls apart, set on the query when called', async () => {
    await seed();

    const query = users();
    const open = query.existsSql(ownTickets('open') as never);
    const done = query.notExistsSql(ownTickets('done') as never);

    expect(Object.values(query.getParameters()).sort()).toEqual(['done', 'open']);
    expect(await ids(query.where(`${open} OR ${done}`))).toEqual([1, 3]);
  });

  it('SHOULD take a factory on an update builder', async () => {
    await seed();

    await context.dataSource
      .createQueryBuilder()
      .update(UserEntity)
      .set({ lastName: 'ticketless' })
      .whereNotExists((sub) =>
        sub
          .select('1')
          .from(TicketEntity, 'ticket')
          .where(`ticket.ownerId = ${nativeSql(`"${context.dataSource.getMetadata(UserEntity).tableName}"."id"`)}`),
      )
      .execute();

    const rows = await context.dataSource.getRepository(UserEntity).find({ order: { id: 'ASC' } });
    expect(rows.filter((user) => user.lastName === 'ticketless').map((user) => user.id)).toEqual([3]);
  });

  it('SHOULD write existsSql into an update condition', async () => {
    await seed();

    const usersTable = context.dataSource.getMetadata(UserEntity).tableName;
    await context.dataSource
      .createQueryBuilder()
      .update(UserEntity)
      .set({ lastName: 'flagged' })
      .where((qb) =>
        `(${qb.existsSql((sub) => sub.select('1').from(TicketEntity, 'ticket').where(`ticket.ownerId = ${nativeSql(`"${usersTable}"."id"`)}`).andWhere('ticket.status = :status', { status: 'done' }))} OR ${nativeSql(`"${usersTable}"."id"`)} = :first)`,
        { first: 1 },
      )
      .execute();

    const rows = await context.dataSource.getRepository(UserEntity).find({ order: { id: 'ASC' } });
    expect(rows.filter((user) => user.lastName === 'flagged').map((user) => user.id)).toEqual([1, 2]);
  });
});
