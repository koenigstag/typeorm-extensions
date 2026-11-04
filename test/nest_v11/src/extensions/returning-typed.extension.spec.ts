import 'typeorm-extensions/extensions/typed/typed-returning/typed-returning.extension';
import { setupTest } from '../test-utils';
import { ImageEntity, PersonEntity, TicketEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

setupTest('returning-typed', undefined, (context) => {
  const tickets = () => context.dataSource.getRepository(TicketEntity);
  const isPostgres = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);

  it('SHOULD fail like returning() on databases without RETURNING', () => {
    if (isPostgres()) {
      return;
    }

    expect(() =>
      tickets().createQueryBuilder().delete().returningTyped((t) => t.id),
    ).toThrow(/RETURNING clause only supported/);
  });

  it('SHOULD set returning to the property paths, embedded and relation ones included', () => {
    if (!isPostgres()) {
      return;
    }

    const update = tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .returningTyped((t) => [t.id, t.status]);
    expect(update.expressionMap.returning).toEqual(['id', 'status']);

    const insert = context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder()
      .insert()
      .values({ name: 'Ann' })
      .returningTyped((p) => p.address.city);
    expect(insert.expressionMap.returning).toEqual(['address.city']);

    const del = context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder()
      .delete()
      .returningTyped((i) => [i.id, i.user]);
    expect(del.expressionMap.returning).toEqual(['id', 'user']);
  });

  it('SHOULD throw for properties that are not columns', () => {
    expect(() =>
      context.dataSource
        .getRepository(ImageEntity)
        .createQueryBuilder()
        .delete()
        .returningTyped((i) => i.user.email),
    ).toThrow(/returningTyped: "user\.email" is not a column of ImageEntity/);
  });
});

// RETURNING: PostgreSQL (TypeORM doesn't support it for SQLite)
setupTest('returning-typed.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const tickets = () => context.dataSource.getRepository(TicketEntity);

  it('SHOULD return the database columns of the properties', async () => {
    const inserted = await tickets()
      .createQueryBuilder()
      .insert()
      .values([
        { status: 'open', ownerId: 1 },
        { status: 'open', ownerId: 2 },
      ])
      .returningTyped((t) => [t.id, t.status])
      .execute();

    expect(inserted.raw).toEqual([
      { ticket_id: expect.any(Number), ticket_status: 'open' },
      { ticket_id: expect.any(Number), ticket_status: 'open' },
    ]);

    const updated = await tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .where('owner_id = :ownerId', { ownerId: 2 })
      .returningTyped((t) => [t.status, t.ownerId])
      .execute();

    expect(updated.raw).toEqual([{ ticket_status: 'done', owner_id: 2 }]);

    const deleted = await tickets()
      .createQueryBuilder()
      .delete()
      .where('owner_id = :ownerId', { ownerId: 1 })
      .returningTyped((t) => t.id)
      .execute();

    expect(deleted.raw).toEqual([{ ticket_id: inserted.raw[0].ticket_id }]);
  });

  it('SHOULD return embedded columns', async () => {
    const result = await context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder()
      .insert()
      .values({ name: 'Ann', address: { city: 'Kyiv', street: 'Main' } })
      .returningTyped((p) => [p.address.city, p.address.street])
      .execute();

    // TypeORM adds the generated id to RETURNING of an INSERT
    expect(result.raw).toEqual([{ addressCity: 'Kyiv', addressStreet_name: 'Main', id: expect.any(Number) }]);
  });
});
