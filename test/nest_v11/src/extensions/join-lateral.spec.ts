import 'typeorm-extensions/extensions/join-lateral.extension';
import { databaseDriver, sqliteDrivers } from '../constants/database';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';

// SQLite has no LATERAL: the queries are only built there
const itRuns = sqliteDrivers.includes(databaseDriver) ? it.skip : it;

setupTest('joinLateral', undefined, (context) => {
  // user 1: an open ticket; user 2: an open one, then a done one; user 3: none
  const seed = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'open', ownerId: 2 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
    ]);
  };

  const users = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user').select('user.id', 'id').orderBy('user.id');

  const latestTicket = () =>
    context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .where(`t.ownerId = ${nativeSql('"user"."id"')}`)
      .orderBy('t.id', 'DESC')
      .limit(1);

  const latestStatus = nativeSql('"latest"."status"');

  it('SHOULD build LEFT JOIN LATERAL and INNER JOIN LATERAL, ON TRUE by default', () => {
    expect(sqlOf(users().leftJoinLateral(latestTicket(), 'latest'))).toMatch(
      /LEFT JOIN LATERAL \(SELECT .+ LIMIT 1\) "latest" ON TRUE/,
    );
    expect(sqlOf(users().innerJoinLateral(latestTicket(), 'latest', '"latest"."status" IS NOT NULL'))).toMatch(
      /INNER JOIN LATERAL \(SELECT .+\) "latest" ON "latest"."status" IS NOT NULL/,
    );
  });

  itRuns('SHOULD join the latest ticket of each user, NULL for a user without one', async () => {
    await seed();

    const rows = await users().addSelect(latestStatus, 'status').leftJoinLateral(latestTicket(), 'latest').getRawMany();

    expect(rows).toEqual([
      { id: 1, status: 'open' },
      { id: 2, status: 'done' },
      { id: 3, status: null },
    ]);
  });

  // the subquery and the outer query both name a parameter `:status`, with different values
  itRuns('SHOULD drop users without a match with INNER, keeping the parameters of a factory subquery apart', async () => {
    await seed();

    const rows = await users()
      .innerJoinLateral(
        (qb) =>
          qb
            .select('t.status', 'status')
            .from(TicketEntity, 't')
            .where(`t.ownerId = ${nativeSql('"user"."id"')}`)
            .andWhere('t.status = :status', { status: 'open' })
            .orderBy('t.id', 'DESC')
            .limit(1),
        'latest',
      )
      .andWhere(`${latestStatus} <> :status`, { status: 'done' })
      .getRawMany();

    expect(rows.map(({ id }) => id)).toEqual([1, 2]);
  });

  itRuns('SHOULD join raw SQL, with its parameters', async () => {
    await seed();

    const rows = await users()
      .addSelect(nativeSql('"open"."tickets"'), 'tickets')
      .leftJoinLateral(
        nativeSql(
          'SELECT COUNT(*) AS "tickets" FROM "tickets" "t" WHERE "t"."owner_id" = "user"."id" AND "t"."ticket_status" = :status',
        ),
        'open',
        'TRUE',
        { status: 'open' },
      )
      .getRawMany();

    // COUNT is a bigint on PostgreSQL, which the driver hands over as a string
    expect(rows.map(({ id, tickets }) => [id, Number(tickets)])).toEqual([
      [1, 1],
      [2, 1],
      [3, 0],
    ]);
  });
});
