import 'typeorm-extensions/extensions/join-unnest.extension';
import { postgresLikeDrivers } from '../constants/database';
import { setupTest, createFakeUsers, sqlOf } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';

setupTest('innerJoinUnnest', undefined, (context) => {
  // unnest() is PostgreSQL's: elsewhere the queries are only built
  const itRuns = (name: string, test: () => Promise<void>) =>
    (postgresLikeDrivers.includes(context.typeormOptions.type as never) ? it : it.skip)(name, test);

  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');
  const tickets = () => context.dataSource.getRepository(TicketEntity).createQueryBuilder('t').orderBy('t.id');

  it('SHOULD join the distinct values of the array, cast to the array of the column type', () => {
    expect(sqlOf(tickets().innerJoinUnnest('t.ownerId', [1, 2]))).toMatch(
      /INNER JOIN \(SELECT DISTINCT unnest\(CAST\(:unnest_\w+ AS \w+\[\]\)\) AS "value"\) "(unnest_\w+)" ON "t"."owner_id" = "\1"."value"/,
    );
  });

  it('SHOULD require the array type for a field that is not an entity column', () => {
    expect(() => tickets().innerJoinUnnest('other.id', [1])).toThrow(TypeError);
    expect(() => tickets().innerJoinUnnest('other.id', [1], 'int[]; DROP TABLE x')).toThrow(TypeError);
    expect(sqlOf(tickets().innerJoinUnnest('other.id', [1], 'bigint[]'))).toContain('AS bigint[]');
  });

  itRuns('SHOULD keep the rows whose column is in the array, once each', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));

    const found = await users().innerJoinUnnest('user.id', [3, 1, 1]).getMany();

    expect(found.map(({ id }) => id)).toEqual([1, 3]);
  });

  itRuns('SHOULD match no row for an empty array', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));

    expect(await users().innerJoinUnnest('user.id', []).getMany()).toEqual([]);
    expect(
      await users().where('user.id = 1').orWhere('user.id = 2').innerJoinUnnest('user.id', []).getMany(),
    ).toEqual([]);
  });
});
