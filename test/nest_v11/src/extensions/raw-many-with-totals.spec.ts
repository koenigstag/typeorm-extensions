import 'typeorm-extensions/extensions/get-many-with-totals.extension';
import { EntityManager } from 'typeorm';
import { setupTest, mysqlRun } from '../test-utils';
import { databaseDriver, postgresLikeDrivers } from '../constants/database';
import { TicketEntity } from '../models';

setupTest('getRawManyWithTotals', undefined, (context) => {
  // owners 1, 1, 2 and none: 4 rows, 3 owner groups
  const seed = () =>
    context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
      new TicketEntity({ status: 'open', ownerId: null }),
    ]);

  const tickets = (manager: EntityManager = context.dataSource.manager) =>
    manager.getRepository(TicketEntity).createQueryBuilder('t');

  // an explicit order replaces the entity's ORDER BY id, which a grouped query can't take
  const byOwner = () =>
    tickets()
      .select('t.ownerId', 'ownerId')
      .addSelect('COUNT(*)', 'tickets')
      .groupBy('t.ownerId')
      .orderBy('t.ownerId', 'ASC');

  it('SHOULD page raw rows and count them all', async () => {
    const [first, second] = await seed();

    const page = await tickets()
      .select('t.id', 'id')
      .addSelect('t.status', 'status')
      .orderBy('t.id', 'ASC')
      .getRawManyWithTotals<{ id: number; status: string }>({ page: 1, pageSize: 2 });

    expect(page).toMatchObject({ total: 4, limit: 2, offset: 0, hasMore: true });
    expect(page.list).toEqual([
      { id: first.id, status: 'open' },
      { id: second.id, status: 'open' },
    ]);
    expect(page.orderBy).toHaveLength(1);
  });

  it('SHOULD count the groups of a grouped query, not the rows they group', async () => {
    await seed();

    const page = await byOwner().getRawManyWithTotals({ page: 1, pageSize: 2 });

    expect(page).toMatchObject({ total: 3, hasMore: true });
    expect(page.list).toHaveLength(2);
  });

  it('SHOULD count only the groups HAVING keeps', async () => {
    await seed();

    const page = await byOwner().having('COUNT(*) > 1').getRawManyWithTotals({ page: 1, pageSize: 2 });

    expect(page).toMatchObject({ total: 1, hasMore: false });
    expect(page.list).toEqual([expect.objectContaining({ ownerId: 1 })]);
  });

  it('SHOULD count with countExpression in place of the subquery', async () => {
    await seed();

    const page = await byOwner()
      .where('t.ownerId IS NOT NULL')
      .getRawManyWithTotals({ page: 1, pageSize: 1 }, { countExpression: 'COUNT(DISTINCT t.ownerId)' });

    expect(page).toMatchObject({ total: 2, hasMore: true });
    expect(page.list).toHaveLength(1);
  });

  it('SHOULD count a DISTINCT query with a COUNT(DISTINCT) expression', async () => {
    await seed();

    const distinctStatuses = () => tickets().select('t.status', 'status').orderBy('t.status');
    const distinct = await distinctStatuses()
      .distinct(true)
      .getRawManyWithTotals({ page: 1, pageSize: 1 }, { countExpression: 'COUNT(DISTINCT t.status)' });

    expect(distinct).toMatchObject({ total: 2, hasMore: true });

    if (postgresLikeDrivers.includes(databaseDriver)) {
      // DISTINCT ON next to the aggregate would be an error
      const distinctOn = await distinctStatuses()
        .distinctOn(['t.status'])
        .getRawManyWithTotals({ page: 1, pageSize: 1 }, { countExpression: 'COUNT(DISTINCT t.status)' });

      expect(distinctOn).toMatchObject({ total: 2, hasMore: true });
    }
  });

  it('SHOULD count with the native parameters of the query', async () => {
    await seed();

    const placeholder = postgresLikeDrivers.includes(databaseDriver) ? '$1' : '?';
    const open = () => tickets().select('t.id', 'id').where(`t.status = ${placeholder}`).setNativeParameters({ status: 'open' });

    expect(await open().getRawManyWithTotals({ page: 1, pageSize: 2 })).toMatchObject({ total: 3, hasMore: true });
    expect(
      await open().getRawManyWithTotals({ page: 1, pageSize: 2 }, { countExpression: 'COUNT(*)' }),
    ).toMatchObject({ total: 3, hasMore: true });
  });

  it('SHOULD wait for the count when the page throws before it starts', async () => {
    await seed();

    // the limit error is thrown as the page query is built, with the count already running
    await expect(
      tickets()
        .select('t.id', 'id')
        .getRawManyWithTotals({ page: 1, pageSize: 'abc' as never }, { countExpression: 'COUNT(no_such_column)' }),
    ).rejects.toThrow(/no_such_column/);
  });

  it('SHOULD probe one row past the page with disableTotalsCalculation', async () => {
    await seed();

    const page = await byOwner().getRawManyWithTotals({ page: 2, pageSize: 2 }, { disableTotalsCalculation: true });

    expect(page).toMatchObject({ total: null, offset: 2, hasMore: false });
    expect(page.list).toHaveLength(1);
  });

  it('SHOULD count inside the transaction of a transactional manager', async () => {
    await seed();

    const total = await context.dataSource.transaction(async (manager) => {
      await manager.getRepository(TicketEntity).save(new TicketEntity({ status: 'open', ownerId: 3 }));

      return (await tickets(manager).select('t.id', 'id').getRawManyWithTotals({ page: 1, pageSize: 1 })).total;
    });

    // the row inserted in the transaction is visible to the count only on its connection
    expect(total).toBe(5);
  });

  // a sleep in the page query only: the count's select list is the countExpression
  const sleep = postgresLikeDrivers.includes(databaseDriver) ? 'pg_sleep(0.3)' : mysqlRun ? 'SLEEP(0.3)' : undefined;

  (sleep ? it : it.skip)('SHOULD fail with the count error only once the page query is done', async () => {
    await seed();
    const started = Date.now();

    await expect(
      tickets()
        .select('t.id', 'id')
        .addSelect(sleep as string, 'slept')
        .getRawManyWithTotals({ page: 1, pageSize: 2 }, { countExpression: 'COUNT(no_such_column)' }),
    ).rejects.toThrow(/no_such_column/);

    // without waiting the count fails in a few milliseconds, with the page still sleeping
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });
});

setupTest('getManyWithTotals / getRawManyWithTotals with a cache id', { entities: [TicketEntity] as const, typeormOptions: { cache: true } }, (context) => {
  const tickets = (cacheId: string) =>
    context.dataSource.getRepository(TicketEntity).createQueryBuilder('t').cache(cacheId, 60_000).orderBy('t.id', 'ASC');

  it('SHOULD read the page and the total from cache entries of their own', async () => {
    await context.dataSource
      .getRepository(TicketEntity)
      .save(['open', 'open', 'done', 'open'].map((status) => new TicketEntity({ status, ownerId: 1 })));

    const reads = [
      () => tickets('entities').getManyWithTotals({ page: 1, pageSize: 2 }),
      () => tickets('raw').select('t.id', 'id').getRawManyWithTotals({ page: 1, pageSize: 2 }),
      () =>
        tickets('raw-count-expression')
          .select('t.id', 'id')
          .getRawManyWithTotals({ page: 1, pageSize: 2 }, { countExpression: 'COUNT(*)' }),
    ];

    for (const read of reads) {
      const first = await read();
      const cached = await read();

      expect(first).toMatchObject({ total: 4, hasMore: true });
      expect(first.list).toHaveLength(2);
      expect(cached).toEqual(first);
    }
  });
});
