import 'typeorm-extensions/extensions/union.extension';
import { setupTest, createFakeUsers, nativeSql } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';
import type { UnionQuery } from 'typeorm-extensions/types/extensions/union.types';

setupTest('union', undefined, (context) => {
  // tickets 1, 3: open (owners 1, 2); ticket 2: closed (owner 1); ticket 4: void
  const seed = async () => {
    await context.dataSource.getRepository(TicketEntity).save(
      [
        ['open', 1],
        ['closed', 1],
        ['open', 2],
        ['void', null],
      ].map(([status, ownerId]) => new TicketEntity({ status: status as string, ownerId: ownerId as number | null })),
    );
  };

  // the same parameter name in every branch, as when one function builds them
  const ticketsWithStatus = (status: string) =>
    context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('ticket')
      .select('ticket.id', 'id')
      .addSelect('ticket.ownerId', 'ownerId')
      .where('ticket.status = :status', { status });

  const unionIds = (queries: UnionQuery[]) =>
    context.dataSource
      .createQueryBuilder()
      .fromUnion(queries, 'u')
      .select('u.id', 'id')
      .getRawMany<{ id: number | string }>()
      .then((rows) => rows.map(({ id }) => Number(id)).sort((a, b) => a - b));

  it('SHOULD keep the value of each part, where a merged parameters object keeps the last one', async () => {
    await seed();

    expect(await unionIds([ticketsWithStatus('open'), ticketsWithStatus('closed')])).toEqual([1, 2, 3]);

    // what pasting getQuery() and merging getParameters() does: both parts read 'closed'
    const [open, closed] = ['open', 'closed'].map((status) =>
      // without the entity's ORDER BY, which can't stand before a UNION
      ticketsWithStatus(status).setOption('disable-global-order'),
    );
    const pasted = await context.dataSource
      .createQueryBuilder()
      .from(`(${open.getQuery()} UNION ${closed.getQuery()})`, 'u')
      .select('u.id', 'id')
      .setParameters({ ...open.getParameters(), ...closed.getParameters() })
      .getRawMany<{ id: number | string }>();

    expect(pasted.map(({ id }) => Number(id))).toEqual([2]);
  });

  it('SHOULD remove duplicate rows, and keep them with all', async () => {
    await seed();

    const twice = () => [ticketsWithStatus('open'), ticketsWithStatus('open')];
    const count = (all: boolean) =>
      context.dataSource
        .createQueryBuilder()
        .fromUnion(twice(), 'u', { all })
        .select('COUNT(*)', 'count')
        .getRawOne<{ count: number | string }>()
        .then((row) => Number(row?.count));

    expect(await count(false)).toBe(2);
    expect(await count(true)).toBe(4);
  });

  it('SHOULD add the union as a common table expression to join, with raw SQL parts', async () => {
    await seed();
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));

    const owners = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addCommonTableExpressionUnion(
        [
          ticketsWithStatus('closed').select('ticket.ownerId', 'ownerId'),
          // raw SQL reads the parameters of the outer builder
          nativeSql('SELECT "owner_id" AS "ownerId" FROM "tickets" WHERE "ticket_status" = :rawStatus'),
        ],
        'owner_ids',
      )
      .innerJoin('owner_ids', 'owner_ids', nativeSql('"owner_ids"."ownerId" = "user"."id"'))
      .setParameter('rawStatus', 'open')
      .getMany();

    // owner 1 is in both parts, and a UNION lists it once
    expect(owners.map(({ id }) => id)).toEqual([1, 2]);
  });

  it('SHOULD throw for no queries', () => {
    expect(() => context.dataSource.createQueryBuilder().fromUnion([], 'u')).toThrow(/fromUnion: no queries to union/);
  });
});
