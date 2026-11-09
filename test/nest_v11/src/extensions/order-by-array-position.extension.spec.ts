import 'typeorm-extensions/extensions/order-by-array-position.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by-array-position.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import 'typeorm-extensions/extensions/where-is-any.extension';
import { setupTest, createFakeUsers, createFakeImages, sqlOf } from '../test-utils';
import { ImageEntity, TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// SQL generation does not depend on the database
setupTest('order-by-array-position.sql', undefined, (context) => {
  it('SHOULD select the position under an alias and order by it', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderBy('user.email')
      .orderByArrayPosition('user.id', [3, 1, 2]);

    const sql = sqlOf(query);
    const [, alias] = sql.match(/array_position\(:position_\w+, "user"\."id"\) AS "(array_position_\w+)"/) ?? [];

    expect(alias).toBe(alias?.toLowerCase());
    // TypeORM 1.x quotes the alias in ORDER BY, 0.3.x leaves it as is
    expect(sql).toMatch(new RegExp(`ORDER BY "?${alias}"? ASC NULLS LAST$`));
    expect(Object.values(query.getParameters())).toEqual([[3, 1, 2]]);
  });

  it('SHOULD add to the ORDER BY with addOrderByArrayPosition', () => {
    const sql = sqlOf(
      context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .orderBy('user.email')
        .addOrderByArrayPosition('user.id', [1], 'int[]'),
    );

    expect(sql).toMatch(/array_position\(CAST\(:position_\w+ AS int\[\]\), "user"\."id"\)/);
    expect(sql).toMatch(/ORDER BY "user"\."email" ASC, "?array_position_\w+"? ASC NULLS LAST$/);
  });

  it('SHOULD take the database column from the typed callback', () => {
    const sql = sqlOf(
      context.dataSource
        .getRepository(TicketEntity)
        .createQueryBuilder('t')
        .orderByArrayPositionTyped((t) => t.id, [2, 1])
        .addOrderByArrayPositionTyped((t) => t.status, ['open'], 'text[]'),
    );

    expect(sql).toMatch(/array_position\(:position_\w+, "t"\."ticket_id"\)/);
    expect(sql).toMatch(/array_position\(CAST\(:position_\w+ AS text\[\]\), "t"\."ticket_status"\)/);
  });

  it('SHOULD throw for values that are not an array and invalid array types', () => {
    const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

    expect(() => query().orderByArrayPosition('user.id', undefined as never)).toThrow(/expects an array/);
    expect(() => query().orderByArrayPosition('user.id', [1], 'int[]) --')).toThrow(/Invalid array type/);
    expect(() => query().orderByArrayPositionTyped((u) => [u.id, u.email], [1])).toThrow(
      /orderByArrayPositionTyped expects the callback to select a single column, got 2/,
    );
  });
});

// array_position: PostgreSQL only
setupTest('order-by-array-position.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = async () => {
    const users = await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 5 }));
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({ count: 5, getOverrides: (i) => ({ id: i + 1, userId: users[i % 2].id }) }),
    );
    return users.map((user) => user.id);
  };

  it('SHOULD keep the order of the given ids, other rows last', async () => {
    const ids = await seed();
    const order = [ids[3], ids[0], ids[4]];

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .orderByArrayPositionTyped((u) => u.id, order)
      .addOrderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.id)).toEqual([...order, ids[1], ids[2]]);
  });

  it('SHOULD work with whereIsAny, joins and take', async () => {
    const ids = await seed();
    const order = [ids[2], ids[1], ids[0]];

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinAndSelectTyped((u) => u.images, 'images')
      .whereIsAny('user.id', order)
      .orderByArrayPosition('user.id', order)
      .take(2)
      .getMany();

    expect(result.map((user) => user.id)).toEqual(order.slice(0, 2));
    expect(result[1].images).toHaveLength(2);
  });
});
