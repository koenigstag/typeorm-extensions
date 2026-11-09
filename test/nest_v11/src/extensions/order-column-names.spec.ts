import 'typeorm-extensions/extensions/order.extension';
import { setupTest, sqlOf } from '../test-utils';
import { TicketEntity, UserEntity } from '../models';

// TicketEntity: id → ticket_id, status → ticket_status, ownerId → owner_id
setupTest('order.column-names', undefined, (context) => {
  const tickets = () => context.dataSource.getRepository(TicketEntity);
  const query = () => tickets().createQueryBuilder('t');

  const seed = () =>
    tickets().save(
      ['b', 'c', 'a'].map((status, i) => new TicketEntity({ status, ownerId: i })),
    );

  it('SHOULD order by the database column of a renamed property', async () => {
    await seed();

    const ordered = query().applyOrder({ field: 'status' });
    expect(sqlOf(ordered)).toMatch(/ORDER BY "ticket_status" ASC$/);
    expect((await ordered.getMany()).map((t) => t.status)).toEqual(['a', 'b', 'c']);

    const byOwner = query().applyOrderFilter({ orderBy: [{ field: 'ownerId', direction: 'desc' }] });
    expect(sqlOf(byOwner)).toMatch(/ORDER BY "owner_id" DESC$/);
    expect((await byOwner.getMany()).map((t) => t.ownerId)).toEqual([2, 1, 0]);
  });

  it('SHOULD qualify always-aliased fields with the alias and the column', async () => {
    await seed();

    const ordered = query().applyOrder({ field: 'id', direction: -1 });
    expect(sqlOf(ordered)).toMatch(/ORDER BY "t"\."ticket_id" DESC$/);
    expect((await ordered.getMany()).map((t) => t.status)).toEqual(['a', 'c', 'b']);
  });

  it('SHOULD leave unquoted alias.property to TypeORM, which maps it', async () => {
    await seed();

    const ordered = query().applyOrder({ field: 'id', direction: 'desc' }, { useQuotes: false });
    expect(sqlOf(ordered)).toMatch(/ORDER BY "t"\."ticket_id" DESC$/);
    expect((await ordered.getMany()).map((t) => t.status)).toEqual(['a', 'c', 'b']);

    const unaliased = query().applyOrder({ field: 'status' }, { useQuotes: false });
    expect(sqlOf(unaliased)).toMatch(/ORDER BY ticket_status ASC$/);
    expect((await unaliased.getMany()).map((t) => t.status)).toEqual(['a', 'b', 'c']);
  });

  it('SHOULD keep property names that are the column names', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .applyOrder({ field: 'createdAt', direction: 'desc' });

    expect(sqlOf(query)).toMatch(/ORDER BY "user"\."createdAt" DESC$/);
  });
});
