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
      tickets()
        .createQueryBuilder()
        .delete()
        .returningTyped((t) => ({ id: t.id })),
    ).toThrow(/RETURNING clause only supported/);
  });

  it('SHOULD write the database columns under the output names', () => {
    if (!isPostgres()) {
      return;
    }

    const update = tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .returningTyped((t) => ({ id: t.id, status: t.status, owner: `${t.ownerId} + 1` }));
    expect(update.expressionMap.returning).toBe('"ticket_id" AS "id", "ticket_status" AS "status", "owner_id" + 1 AS "owner"');

    const insert = context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder()
      .insert()
      .values({ name: 'Ann' })
      .returningTyped((p) => ({ city: p.address.city }));
    expect(insert.expressionMap.returning).toBe('"addressCity" AS "city"');

    const del = context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder()
      .delete()
      .returningTyped((i) => ({ id: i.id, userId: i.user }));
    expect(del.expressionMap.returning).toBe('"id" AS "id", "userId" AS "userId"');
  });

  it('SHOULD write the rows before and after the write', () => {
    if (!isPostgres()) {
      return;
    }

    const update = tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .returningTyped(({ old, new: next }) => ({
        before: old.status,
        changed: `${old.status} IS DISTINCT FROM ${next.status}`,
      }));
    expect(update.expressionMap.returning).toBe(
      'old."ticket_status" AS "before", old."ticket_status" IS DISTINCT FROM new."ticket_status" AS "changed"',
    );
  });

  it('SHOULD throw for properties that are not columns', () => {
    expect(() =>
      context.dataSource
        .getRepository(ImageEntity)
        .createQueryBuilder()
        .delete()
        .returningTyped((i) => ({ email: i.user.email })),
    ).toThrow(/returningTyped: "user\.email" is not a column of ImageEntity/);
  });

  it('SHOULD throw for a selection that is not an object of outputs', () => {
    const builder = () => tickets().createQueryBuilder().delete();

    expect(() => builder().returningTyped((t) => [t.id] as never)).toThrow(/return an object of output names/);
    expect(() => builder().returningTyped(() => ({}))).toThrow(/return at least one output/);
    expect(() => builder().returningTyped(() => ({ id: 1 as never }))).toThrow(/"id" must be a column or an SQL expression/);
  });

  it('SHOULD allow old and new on PostgreSQL only', () => {
    if (context.typeormOptions.type === 'postgres') {
      return;
    }

    expect(() =>
      tickets()
        .createQueryBuilder()
        .delete()
        .returningTyped(({ old }) => ({ id: old.id })),
    ).toThrow(/"old" is supported on PostgreSQL 18\+ only/);
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

  it('SHOULD return exactly the outputs, under their names', async () => {
    const inserted = await tickets()
      .createQueryBuilder()
      .insert()
      .values([
        { status: 'open', ownerId: 1 },
        { status: 'open', ownerId: 2 },
      ])
      .returningTyped((t) => ({ id: t.id, status: t.status }))
      .execute();

    expect(inserted.raw).toEqual([
      { id: expect.any(Number), status: 'open' },
      { id: expect.any(Number), status: 'open' },
    ]);

    const updated = await tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .where('owner_id = :ownerId', { ownerId: 2 })
      .returningTyped((t) => ({ status: t.status, ownerId: t.ownerId, isDone: `${t.status} = 'done'` }))
      .execute();

    expect(updated.raw).toEqual([{ status: 'done', ownerId: 2, isDone: true }]);

    const deleted = await tickets()
      .createQueryBuilder()
      .delete()
      .where('owner_id = :ownerId', { ownerId: 1 })
      .returningTyped((t) => ({ id: t.id }))
      .execute();

    expect(deleted.raw).toEqual([{ id: inserted.raw[0].id }]);
  });

  it('SHOULD return embedded columns', async () => {
    const result = await context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder()
      .insert()
      .values({ name: 'Ann', address: { city: 'Kyiv', street: 'Main' } })
      .returningTyped((p) => ({ city: p.address.city, street: p.address.street }))
      .execute();

    expect(result.raw).toEqual([{ city: 'Kyiv', street: 'Main' }]);
  });

  it('SHOULD return the row before and after the write on PostgreSQL 18+', async () => {
    const [{ supported }] = await context.dataSource.query(
      `SELECT current_setting('server_version_num')::int >= 180000 AS "supported"`,
    );

    if (!supported) {
      return;
    }

    await tickets().insert({ status: 'open', ownerId: 3 });

    const updated = await tickets()
      .createQueryBuilder()
      .update()
      .set({ status: 'done' })
      .where('owner_id = :ownerId', { ownerId: 3 })
      .returningTyped(({ old, new: next }) => ({
        before: old.status,
        after: next.status,
        changed: `${old.status} IS DISTINCT FROM ${next.status}`,
      }))
      .execute();

    expect(updated.raw).toEqual([{ before: 'open', after: 'done', changed: true }]);

    const inserted = await tickets()
      .createQueryBuilder()
      .insert()
      .values({ status: 'open', ownerId: 4 })
      .returningTyped(({ old, new: next }) => ({ before: old.status, after: next.status }))
      .execute();

    expect(inserted.raw).toEqual([{ before: null, after: 'open' }]);
  });
});
