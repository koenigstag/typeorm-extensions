import 'typeorm-extensions/extensions/query-returning.extension';
import { postgresLikeDrivers } from '../constants/database';
import { setupTest, mysqlRun, nativeSql } from '../test-utils';
import { TicketEntity } from '../models';

setupTest('queryReturning', undefined, (context) => {
  const postgresRun = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);
  // PostgreSQL numbers its placeholders, MySQL and SQLite take `?`
  const param = (index: number) => (postgresRun() ? `$${index}` : '?');

  const seed = () =>
    context.dataSource
      .getRepository(TicketEntity)
      .save([
        new TicketEntity({ status: 'open', ownerId: 1 }),
        new TicketEntity({ status: 'open', ownerId: 2 }),
        new TicketEntity({ status: 'done', ownerId: 3 }),
      ]);

  const statusesById = async () =>
    (await context.dataSource.getRepository(TicketEntity).find()).map(({ id, status }) => [id, status]);

  // MySQL has no RETURNING
  (mysqlRun ? it.skip : it)('SHOULD resolve the RETURNING rows of an UPDATE, not [rows, count]', async () => {
    const [first] = await seed();

    const result = await context.dataSource.manager.queryReturning<{ ticket_id: number; ticket_status: string }>(
      nativeSql(
        `UPDATE "tickets" SET "ticket_status" = ${param(1)} WHERE "ticket_id" = ${param(2)} RETURNING "ticket_id", "ticket_status"`,
      ),
      ['closed', first.id],
    );

    expect(result.records).toEqual([{ ticket_id: first.id, ticket_status: 'closed' }]);
    // SQLite reports no count for a statement that returns rows
    expect(result.affected).toBe(postgresRun() ? 1 : null);
  });

  it('SHOULD resolve the count of a plain UPDATE with no records', async () => {
    await seed();

    const result = await context.dataSource.manager.queryReturning(
      nativeSql(`UPDATE "tickets" SET "ticket_status" = ${param(1)} WHERE "ticket_status" = ${param(2)}`),
      ['closed', 'open'],
    );

    expect(result).toEqual({ records: [], affected: 2 });
  });

  it('SHOULD run on the query runner of a transactional manager, so a rollback undoes the statement', async () => {
    await seed();
    const before = await statusesById();

    await expect(
      context.dataSource.transaction(async (manager) => {
        await manager.queryReturning(nativeSql(`UPDATE "tickets" SET "ticket_status" = ${param(1)}`), ['closed']);
        throw new Error('roll back');
      }),
    ).rejects.toThrow('roll back');

    expect(await statusesById()).toEqual(before);
  });

  it('SHOULD be available on a repository and on the data source', async () => {
    await seed();
    const select = nativeSql(`SELECT "ticket_status" FROM "tickets" WHERE "ticket_status" = ${param(1)}`);

    const fromRepository = await context.dataSource.getRepository(TicketEntity).queryReturning(select, ['open']);
    const fromDataSource = await context.dataSource.queryReturning(select, ['open']);

    expect(fromRepository.records).toEqual([{ ticket_status: 'open' }, { ticket_status: 'open' }]);
    expect(fromDataSource.records).toEqual(fromRepository.records);
  });
});
