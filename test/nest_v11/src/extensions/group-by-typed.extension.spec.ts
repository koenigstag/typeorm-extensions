import 'typeorm-extensions/extensions/typed/typed-group-by/typed-group-by.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { createFakeUser, nativeSql, setupTest, sqlOf } from '../test-utils';
import { ImageEntity, PersonEntity, TicketEntity, UserEntity } from '../models';

setupTest('group-by-typed', undefined, (context) => {
  it('SHOULD group by the database column of the property', async () => {
    const tickets = context.dataSource.getRepository(TicketEntity);

    await tickets.save(
      ['open', 'closed', 'open', 'open'].map((status) => new TicketEntity({ status })),
    );

    const typed = tickets
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupByTyped((t) => t.status)
      .setOption('disable-global-order');
    const untyped = tickets
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.status')
      .setOption('disable-global-order');

    expect(sqlOf(typed)).toContain('GROUP BY "ticket"."ticket_status"');
    expect(sqlOf(typed)).toEqual(sqlOf(untyped));

    const rows = await typed.getRawMany<{ status: string; count: number | string }>();

    expect(
      rows.map((row) => ({ status: row.status, count: Number(row.count) })).sort((a, b) => a.status.localeCompare(b.status)),
    ).toEqual([
      { status: 'closed', count: 1 },
      { status: 'open', count: 3 },
    ]);
  });

  it('SHOULD replace GROUP BY with several columns and add columns of a joined alias', async () => {
    const users = context.dataSource.getRepository(UserEntity);
    const [withImages, withoutImages] = await users.save([createFakeUser(), createFakeUser()]);

    await context.dataSource
      .getRepository(ImageEntity)
      .save([1, 2, 3].map((id) => new ImageEntity({ id, url: `https://img/${id}`, userId: withImages.id })));

    const counts = await users
      .createQueryBuilder('user')
      .leftJoinTyped((u) => u.images, 'images')
      .select('user.id', 'id')
      .addSelect('user.firstName', 'firstName')
      .addSelect('COUNT(images.id)', 'images')
      .groupBy('user.email')
      .groupByTyped((u) => [u.id, u.firstName])
      .setOption('disable-global-order')
      .getRawMany<{ id: number | string; images: number | string }>();

    expect(
      Object.fromEntries(counts.map((row) => [Number(row.id), Number(row.images)])),
    ).toEqual({ [withImages.id]: 3, [withoutImages.id]: 0 });

    const query = users
      .createQueryBuilder('user')
      .leftJoinTyped((u) => u.images, 'images')
      .groupByTyped((u) => [u.id, u.firstName])
      .addGroupByTyped((u) => u.images.url);

    expect(query.expressionMap.groupBys).toEqual(['user.id', 'user.firstName', 'images.url']);
    expect(sqlOf(query)).toContain('GROUP BY "user"."id", "user"."firstName", "images"."url"');
  });

  it('SHOULD quote the database column with useQuotes and reject a JSON path', () => {
    const ticketQuery = context.dataSource.getRepository(TicketEntity).createQueryBuilder('ticket');

    expect(
      ticketQuery.groupByTyped((t) => t.status, { useQuotes: true }).addGroupByTyped((t) => t.ownerId, { useQuotes: true })
        .expressionMap.groupBys,
    ).toEqual([nativeSql('"ticket"."ticket_status"'), nativeSql('"ticket"."owner_id"')]);

    const userQuery = context.dataSource.getRepository(UserEntity).createQueryBuilder('user').groupBy('user.id');

    expect(() => userQuery.groupByTyped((u) => u.metadata.role)).toThrow(
      /points into the JSON column "metadata": select, order, distinct and group by take columns only/,
    );
    // the key is resolved before GROUP BY is replaced, so a throwing call leaves it as it was
    expect(userQuery.expressionMap.groupBys).toEqual(['user.id']);

    // @ts-expect-error not a property of the entity
    userQuery.addGroupByTyped((u) => u.nickname);
  });

  it('SHOULD group by a JSON column as a whole and reject a relation or an embedded entity', async () => {
    const users = context.dataSource.getRepository(UserEntity);

    const metadata = { role: 'admin', settings: { theme: 'dark', status: 'on' } };

    await users.save([createFakeUser({ metadata }), createFakeUser({ metadata })]);

    const byMetadata = users
      .createQueryBuilder('user')
      .select('COUNT(*)', 'count')
      .groupByTyped((u) => u.metadata)
      .setOption('disable-global-order');

    expect(sqlOf(byMetadata)).toContain('GROUP BY "user"."metadata"');
    expect((await byMetadata.getRawMany()).map((row) => Number(row.count))).toEqual([2]);

    const byOwner = context.dataSource.getRepository(ImageEntity).createQueryBuilder('image').groupByTyped((i) => i.user);
    expect(sqlOf(byOwner)).toContain('GROUP BY "image"."userId"');

    expect(() => users.createQueryBuilder('user').groupByTyped((u) => u.images)).toThrow(
      /groupByTyped: "images" is a relation without a join column in its table/,
    );
    expect(() =>
      context.dataSource.getRepository(PersonEntity).createQueryBuilder('p').addGroupByTyped((p) => [p.id, p.address]),
    ).toThrow(/addGroupByTyped|groupByTyped: "address" is an embedded entity/);
  });
});
