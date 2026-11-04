import 'typeorm-extensions/extensions/get-many-with-totals.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest, createFakeUsers, createFakeImages } from '../test-utils';
import { ImageEntity, TicketEntity, UserEntity } from '../models';

setupTest('tableHelper.count rows', undefined, (context) => {
  it('SHOULD count all, distinct and matching rows in one query, with CASE and FILTER', async () => {
    const tickets = context.dataSource.getRepository(TicketEntity);
    await tickets.save(
      [
        ['open', 1],
        ['open', 1],
        ['done', 2],
        ['open', null],
      ].map(([status, ownerId]) => new TicketEntity({ status: status as string, ownerId: ownerId as number | null })),
    );

    // a helper keyed by the database columns of `tickets`
    const t = tableHelper<{ ticket_id: number; ticket_status: string; owner_id: number | null }>('t');
    const open = t.where('ticket_status', "= 'open'");

    const row = await tickets
      .createQueryBuilder('t')
      .select(t.count('ticket_id'), 'total')
      .addSelect(t.count('owner_id', { distinct: true }), 'owners')
      .addSelect(t.count('ticket_id', { filter: open }), 'openCase')
      .addSelect(t.count('ticket_id', { filter: open, syntax: 'filter' }), 'openFilter')
      .addSelect(t.count('owner_id', { filter: open, distinct: true }), 'openOwners')
      // an explicit order replaces the entity's default ORDER BY id, which PostgreSQL rejects next to aggregates
      .orderBy('total')
      .getRawOne();

    expect(row).toEqual({ total: 4, owners: 2, openCase: 3, openFilter: 3, openOwners: 1 });
  });
});

setupTest('getManyWithTotals.useTakeAndSkip', undefined, (context) => {
  it('SHOULD accept useTakeAndSkip in its options type and page entities with joined collections', async () => {
    const users = await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({ count: 4, getOverrides: (i) => ({ id: i + 1, userId: users[0].id }) }),
    );

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinAndSelectTyped((u) => u.images, 'images')
      .orderBy('user.id', 'ASC')
      .getManyWithTotals({ page: 1, pageSize: 2 }, { useTakeAndSkip: true });

    expect(page.total).toBe(3);
    expect(page.list.map((user) => user.id)).toEqual([users[0].id, users[1].id]);
    expect(page.list[0].images).toHaveLength(4);
  });
});
