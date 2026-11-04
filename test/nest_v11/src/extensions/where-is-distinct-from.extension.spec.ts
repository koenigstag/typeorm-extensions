import 'typeorm-extensions/extensions/where-is-distinct-from.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-distinct-from.extension';
import { DataSource } from 'typeorm';
import { setupTest } from '../test-utils';
import { TicketEntity } from '../models';
import { postgresLikeDrivers, sqliteDrivers } from '../constants/database';

const seedTickets = (dataSource: DataSource) =>
  dataSource.getRepository(TicketEntity).save([
    new TicketEntity({ status: 'one', ownerId: 1 }),
    new TicketEntity({ status: 'two', ownerId: 2 }),
    new TicketEntity({ status: 'none', ownerId: null }),
  ]);

const statuses = (tickets: TicketEntity[]) => tickets.map((ticket) => ticket.status);

setupTest('where-is-distinct-from', undefined, (context) => {
  it('SHOULD build the null-safe comparison of the database', () => {
    const query = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .whereIsDistinctFromTyped((t) => t.ownerId, 1)
      .andWhereIsNotDistinctFrom('t.ticket_status', 'one');

    const type = context.typeormOptions.type;

    if (sqliteDrivers.includes(type as never)) {
      expect(query.getQuery()).toMatch(
        /WHERE "t"\."owner_id" IS NOT :where\w+ AND "t"\."ticket_status" IS :andWhere_\w+/,
      );
    } else if (postgresLikeDrivers.includes(type as never)) {
      expect(query.getQuery()).toMatch(
        /WHERE "t"\."owner_id" IS DISTINCT FROM :where\w+ AND "t"\."ticket_status" IS NOT DISTINCT FROM :andWhere_\w+/,
      );
    }
  });

  it('SHOULD compare with the NULL literal for null and undefined', () => {
    const [query, parameters] = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .whereIsNotDistinctFromTyped((t) => t.ownerId, null)
      .orWhereIsDistinctFrom('t.owner_id', undefined)
      .getQueryAndParameters();

    expect(query).toMatch(/WHERE "t"\."owner_id" IS (NOT DISTINCT FROM )?NULL OR "t"\."owner_id" IS (DISTINCT FROM |NOT )NULL/);
    expect(parameters).toEqual([]);
  });

  it('SHOULD keep NULL rows that `<>` drops', async () => {
    await seedTickets(context.dataSource);
    const repository = context.dataSource.getRepository(TicketEntity);

    const distinct = await repository
      .createQueryBuilder('t')
      .whereIsDistinctFromTyped((t) => t.ownerId, 1)
      .getMany();
    expect(statuses(distinct)).toEqual(['two', 'none']);

    const notEqual = await repository
      .createQueryBuilder('t')
      .where('t.ownerId <> :ownerId', { ownerId: 1 })
      .getMany();
    expect(statuses(notEqual)).toEqual(['two']);
  });

  it('SHOULD match NULL with whereIsNotDistinctFrom(null)', async () => {
    await seedTickets(context.dataSource);
    const repository = context.dataSource.getRepository(TicketEntity);

    const isNull = await repository
      .createQueryBuilder('t')
      .whereIsNotDistinctFromTyped((t) => t.ownerId, null)
      .getMany();
    expect(statuses(isNull)).toEqual(['none']);

    const equal = await repository
      .createQueryBuilder('t')
      .whereIsNotDistinctFromTyped((t) => t.ownerId, 2)
      .orWhereIsNotDistinctFromTyped((t) => t.status, 'one')
      .getMany();
    expect(statuses(equal)).toEqual(['one', 'two']);
  });

  it('SHOULD update and delete with a bare column', async () => {
    await seedTickets(context.dataSource);
    const repository = context.dataSource.getRepository(TicketEntity);

    const update = repository
      .createQueryBuilder()
      .update()
      .set({ status: 'unassigned' })
      .whereIsNotDistinctFromTyped((t) => t.ownerId, null);
    expect(update.getQuery()).toMatch(/WHERE "owner_id" IS (NOT DISTINCT FROM )?NULL$/);
    await update.execute();

    await repository
      .createQueryBuilder()
      .delete()
      .whereIsDistinctFromTyped((t) => t.ownerId, null)
      .andWhereIsDistinctFromTyped((t) => t.ownerId, 1)
      .execute();

    expect(statuses(await repository.find())).toEqual(['one', 'unassigned']);
  });
});

describe('where-is-distinct-from.mysql', () => {
  // SQL generation only: the data source is never connected
  it.each(['mysql', 'mariadb'] as const)('SHOULD use `<=>` and backticks on %s', (type) => {
    const query = new DataSource({ type })
      .createQueryBuilder()
      .select('t.id')
      .from('tickets', 't')
      .whereIsDistinctFrom('t.owner_id', 1)
      .andWhereIsNotDistinctFrom('t.ticket_status', null);

    expect(query.getQuery()).toMatch(
      /WHERE NOT \(`t`\.`owner_id` <=> :where_\w+\) AND `t`\.`ticket_status` <=> NULL$/,
    );
  });
});
