import 'typeorm-extensions/extensions/typed/typed-select/select-row.extension';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { unnestRows } from 'typeorm-extensions/utils/unnest-rows.utils';
import { setupTest, nativeSql } from '../test-utils';
import { TicketEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

type OwnerTicketsRow = Record<'ownerId' | 'tickets', unknown>;

setupTest('select-row', undefined, (context) => {
  const isPostgres = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);

  const helpers = () => {
    const driver = context.typeormOptions.type;

    return {
      ticket: tableHelper(TicketEntity, 'ticket', { driver }),
      ownerTickets: tableHelper<OwnerTicketsRow>('owner_tickets', { driver }),
    };
  };

  const ownerTicketsQuery = () => {
    const { ticket, ownerTickets } = helpers();

    return context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('ticket')
      .addSelect(ticket.status)
      .selectRow(ownerTickets, { ownerId: ticket.ownerId, tickets: 'COUNT(*)' })
      .where(`${ticket.ownerId} IS NOT NULL`)
      .groupBy(ticket.ownerId)
      .setOption('disable-global-order');
  };

  it('SHOULD replace the selection with each column of the row under its name, in the order given', () => {
    expect(ownerTicketsQuery().getQuery()).toContain(
      nativeSql('SELECT "ticket"."owner_id" AS "ownerId", COUNT(*) AS "tickets" FROM'),
    );
  });

  it('SHOULD give the CTE the columns the outer query reads', async () => {
    await context.dataSource
      .getRepository(TicketEntity)
      .save(
        [['open', 1], ['closed', 1], ['open', 2], ['void', null]].map(
          ([status, ownerId]) => new TicketEntity({ status: status as string, ownerId: ownerId as number | null }),
        ),
      );

    const { ownerTickets } = helpers();
    const rows = await context.dataSource
      .createQueryBuilder()
      .addCommonTableExpression(ownerTicketsQuery(), 'owner_tickets')
      .from('owner_tickets', 'owner_tickets')
      .select(ownerTickets.ownerId, 'ownerId')
      .addSelect(ownerTickets.tickets, 'tickets')
      .orderBy(ownerTickets.ownerId)
      .getRawMany<{ ownerId: number | string; tickets: number | string }>();

    expect(rows.map(({ ownerId, tickets }) => [Number(ownerId), Number(tickets)])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('SHOULD zip the arrays into rows under the names of the row, with the ordinality column last', async () => {
    const pairs = tableHelper<Record<'ownerId' | 'status' | 'ord', unknown>>('pairs');

    expect(unnestRows(pairs, { ownerId: ':ownerIds::int[]', status: ':statuses::text[]' }, { ordinality: 'ord' })).toBe(
      'SELECT * FROM unnest(:ownerIds::int[], :statuses::text[]) WITH ORDINALITY AS t("ownerId", "status", "ord")',
    );
    // @ts-expect-error ord is the ordinality column, not an array
    unnestRows(pairs, { ownerId: ':o', status: ':s', ord: ':n' }, { ordinality: 'ord' });
    // @ts-expect-error ord is missing without the ordinality option
    unnestRows(pairs, { ownerId: ':o', status: ':s' });

    if (!isPostgres()) {
      return;
    }

    const rows = await context.dataSource
      .createQueryBuilder()
      .addCommonTableExpression(
        unnestRows(pairs, { ownerId: ':ownerIds::int[]', status: ':statuses::text[]' }, { ordinality: 'ord' }),
        'pairs',
      )
      .from('pairs', 'pairs')
      .select(pairs.status, 'status')
      .addSelect(pairs.ord, 'ord')
      .where(`${pairs.ownerId} > :min`, { min: 1 })
      .setParameters({ ownerIds: [1, 2, 3], statuses: ['open', 'closed', 'void'] })
      .orderBy(pairs.ord)
      .getRawMany<{ status: string; ord: number | string }>();

    expect(rows.map(({ status, ord }) => [status, Number(ord)])).toEqual([
      ['closed', 2],
      ['void', 3],
    ]);
  });

  it('SHOULD reject a row without columns', () => {
    const empty = tableHelper<Record<never, unknown>>('empty');

    expect(() => context.dataSource.createQueryBuilder().selectRow(empty, {})).toThrow(TypeError);
  });

  it('SHOULD take exactly the columns of the row', () => {
    const { ticket, ownerTickets } = helpers();
    const query = () => context.dataSource.getRepository(TicketEntity).createQueryBuilder('ticket');

    // @ts-expect-error tickets is missing
    query().selectRow(ownerTickets, { ownerId: ticket.ownerId });
    // @ts-expect-error owner is not a column of the row
    query().selectRow(ownerTickets, { ownerId: ticket.ownerId, tickets: 'COUNT(*)', owner: ticket.ownerId });
    // @ts-expect-error ownerID is misspelled
    query().selectRow(ownerTickets, { ownerID: ticket.ownerId, tickets: 'COUNT(*)' });
  });
});
