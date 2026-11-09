import 'typeorm-extensions/extensions/get-many-with-totals.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { postgresLikeDrivers } from '../constants/database';
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
      .addSelect(t.count(), 'rows')
      .addSelect(t.count(undefined, { filter: open, syntax: 'filter' }), 'openRows')
      .addSelect(t.count('owner_id', { distinct: true }), 'owners')
      .addSelect(t.count('ticket_id', { filter: open }), 'openCase')
      .addSelect(t.count('ticket_id', { filter: open, syntax: 'filter' }), 'openFilter')
      .addSelect(t.count('owner_id', { filter: open, distinct: true }), 'openOwners')
      // an explicit order replaces the entity's default ORDER BY id, which PostgreSQL rejects next to aggregates
      .orderBy('total')
      .getRawOne();

    expect(row).toEqual({ total: 4, rows: 4, openRows: 3, owners: 2, openCase: 3, openFilter: 3, openOwners: 1 });
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

setupTest('getManyWithTotals.hasMore', undefined, (context) => {
  it('SHOULD report hasMore while pages are left and false on the last page', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    const users = context.dataSource.getRepository(UserEntity);

    const first = await users.createQueryBuilder('user').getManyWithTotals({ page: 1, pageSize: 2 });
    const last = await users.createQueryBuilder('user').getManyWithTotals({ page: 2, pageSize: 2 });

    expect(first).toMatchObject({ total: 3, offset: 0, hasMore: true });
    expect(first.list).toHaveLength(2);
    expect(last).toMatchObject({ total: 3, offset: 2, hasMore: false });
    expect(last.list).toHaveLength(1);
  });

  it('SHOULD report hasMore as null only with loadAll', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));

    const all = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .getManyWithTotals({}, { loadAll: true });

    expect(all).toMatchObject({ total: 3, limit: null, offset: null, hasMore: null });
    expect(all.list).toHaveLength(3);
  });

  // without a total, the page is read one row longer and the extra row is dropped
  it('SHOULD know hasMore without a count query, and not return the probe row', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    const users = context.dataSource.getRepository(UserEntity);
    const options = { disableTotalsCalculation: true };

    const first = await users.createQueryBuilder('user').getManyWithTotals({ page: 1, pageSize: 2 }, options);
    const last = await users.createQueryBuilder('user').getManyWithTotals({ page: 2, pageSize: 2 }, options);

    expect(first).toMatchObject({ total: null, limit: 2, offset: 0, hasMore: true });
    expect(first.list).toHaveLength(2);
    expect(last).toMatchObject({ total: null, limit: 2, offset: 2, hasMore: false });
    expect(last.list).toHaveLength(1);

    // the pages stay the pages: no row is skipped or repeated by the probe
    const all = await users.createQueryBuilder('user').orderBy('user.id', 'ASC').getMany();
    expect([...first.list, ...last.list].map((user) => user.id)).toEqual(all.map((user) => user.id));
  });

  it('SHOULD drop the probe row with useTakeAndSkip and a joined collection', async () => {
    const users = await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({ count: 4, getOverrides: (i) => ({ id: i + 1, userId: users[0].id }) }),
    );

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinAndSelectTyped((u) => u.images, 'images')
      .orderBy('user.id', 'ASC')
      .getManyWithTotals(
        { page: 1, pageSize: 2 },
        { disableTotalsCalculation: true, useTakeAndSkip: true },
      );

    expect(page).toMatchObject({ total: null, hasMore: true });
    expect(page.list.map((user) => user.id)).toEqual([users[0].id, users[1].id]);
    expect(page.list[0].images).toHaveLength(4);
  });
});

setupTest('getManyWithTotals.orderBy', undefined, (context) => {
  it('SHOULD return the ORDER BY clauses the query was built with', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderBy('user.firstName', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .getManyWithTotals({ page: 1, pageSize: 2 });

    expect(page.orderBy).toEqual([
      { selector: 'user.firstName', order: 'DESC' },
      { selector: 'user.id', order: 'ASC' },
    ]);
  });

  // UserEntity is @Entity({ orderBy: { id: 'ASC' } }), which the SQL falls back to
  it("SHOULD return the entity's default order when the query sets none", async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .getManyWithTotals({ page: 1, pageSize: 2 });

    expect(page.orderBy).toEqual([{ selector: 'user.id', order: 'ASC' }]);
  });

  it('SHOULD return an empty orderBy when the global order is disabled', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .setOption('disable-global-order')
      .getManyWithTotals({ page: 1, pageSize: 2 });

    expect(page.orderBy).toEqual([]);
  });
});

// NULLS FIRST / LAST: PostgreSQL only
setupTest('getManyWithTotals.orderBy.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD carry the nulls ordering through', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));

    const page = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderBy('user.firstName', 'DESC', 'NULLS LAST')
      .getManyWithTotals({ page: 1, pageSize: 2 });

    expect(page.orderBy).toEqual([
      { selector: 'user.firstName', order: 'DESC', nulls: 'NULLS LAST' },
    ]);
  });
});
