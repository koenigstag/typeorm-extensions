import 'typeorm-extensions/index';
import { setupTest, sqlOf } from '../test-utils';
import { createFakeUsers } from '../test-utils';
import { PersonEntity, TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

setupTest('typed keys.embedded columns', undefined, (context) => {
  const seed = () =>
    context.dataSource.getRepository(PersonEntity).save([
      new PersonEntity({ name: 'a', address: { city: 'Kyiv', street: 'Khreshchatyk' } }),
      new PersonEntity({ name: 'b', address: { city: 'Lviv', street: 'Rynok' } }),
      new PersonEntity({ name: 'c', address: { city: 'Odesa', street: 'Derybasivska' } }),
    ]);

  const columnOf = (propertyPath: string) =>
    context.dataSource
      .getRepository(PersonEntity)
      .metadata.findColumnWithPropertyPath(propertyPath)!.databaseName;

  it('SHOULD map embedded paths in typed where to the main alias column', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder('p')
      .whereTyped((p) => p.address.city, '=', 'Lviv')
      .orWhereIsInTyped((p) => p.address.street, ['Derybasivska']);

    expect(sqlOf(query)).toContain(`WHERE "p"."${columnOf('address.city')}" = :where_`);
    expect(sqlOf(query)).toContain(`OR "p"."${columnOf('address.street')}" IN (`);

    const result = await query.getMany();
    expect(result.map((person) => person.name)).toEqual(['b', 'c']);
  });

  it('SHOULD map embedded paths on UPDATE', async () => {
    await seed();
    const repository = context.dataSource.getRepository(PersonEntity);

    const update = repository
      .createQueryBuilder()
      .update()
      .set({ name: 'moved' })
      .whereTyped((p) => p.address.city, '=', 'Kyiv');

    expect(sqlOf(update)).toMatch(new RegExp(`WHERE "${columnOf('address.city')}" = :where_\\w+$`));
    await update.execute();

    expect((await repository.find()).map((person) => person.name)).toEqual(['moved', 'b', 'c']);
  });

  it('SHOULD select and order by embedded paths', async () => {
    await seed();
    const repository = context.dataSource.getRepository(PersonEntity);

    const rows = await repository
      .createQueryBuilder('p')
      .selectTyped((p) => p.address.city, 'city')
      .orderByTyped((p) => p.address.city, 'DESC')
      .getRawMany();
    expect(rows.map((row) => row.city)).toEqual(['Odesa', 'Lviv', 'Kyiv']);

    const quoted = repository
      .createQueryBuilder('p')
      .selectTyped((p) => p.address.street, 'street', true)
      .addOrderByTyped((p) => p.address.street, 'ASC', undefined, { useQuotes: true });
    expect(sqlOf(quoted)).toContain(`"p"."${columnOf('address.street')}" AS "street"`);
    expect(sqlOf(quoted)).toContain(`ORDER BY "p"."${columnOf('address.street')}" ASC`);
    expect((await quoted.getRawMany()).map((row) => row.street)).toEqual([
      'Derybasivska',
      'Khreshchatyk',
      'Rynok',
    ]);
  });

  it('SHOULD use DISTINCT ON with an embedded path (postgres)', async () => {
    if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      return;
    }

    await seed();
    const query = context.dataSource
      .getRepository(PersonEntity)
      .createQueryBuilder('p')
      .distinctOnTyped((p) => p.address.city)
      .orderBy('p.address.city', 'ASC');

    expect(sqlOf(query)).toContain(`DISTINCT ON ("p"."${columnOf('address.city')}")`);
    expect(await query.getRawMany()).toHaveLength(3);
  });

  it('SHOULD still treat a joined alias as an alias', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinTyped((u) => u.images, 'images')
      .whereTyped((u) => u.images.url, 'IS NOT NULL')
      .orderByTyped((u) => u.images.url);

    expect(sqlOf(query)).toContain('WHERE "images"."url" IS NOT NULL');
    expect(sqlOf(query)).toContain('ORDER BY "images"."url"');
  });
});

setupTest('typed keys.useQuotes with database names', undefined, (context) => {
  it('SHOULD quote the database column name in select / order by', async () => {
    const repository = context.dataSource.getRepository(TicketEntity);
    await repository.save([
      new TicketEntity({ status: 'open', ownerId: null }),
      new TicketEntity({ status: 'closed', ownerId: null }),
    ]);

    const query = repository
      .createQueryBuilder('t')
      .selectTyped((t) => t.status, 'status', true)
      .orderByTyped((t) => t.status, 'ASC', undefined, { useQuotes: true });

    expect(sqlOf(query)).toContain('"t"."ticket_status" AS "status"');
    expect(sqlOf(query)).toContain('ORDER BY "t"."ticket_status" ASC');
    expect((await query.getRawMany()).map((row) => row.status)).toEqual(['closed', 'open']);
  });

  it('SHOULD quote every key of an array selection', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 1 }));

    const repository = context.dataSource.getRepository(UserEntity);

    // array of callbacks
    const callbacks = repository
      .createQueryBuilder('user')
      .selectTyped([(u) => u.id, (u) => u.firstName], true);
    expect(sqlOf(callbacks)).toMatch(/^SELECT "user"\."id", "user"\."firstName" FROM/);
    expect(await callbacks.getRawMany()).toHaveLength(1);

    // one callback returning several keys
    const several = repository
      .createQueryBuilder('user')
      .selectTyped((u) => [u.id, u.firstName], undefined, true);
    expect(sqlOf(several)).toMatch(/^SELECT "user"\."id", "user"\."firstName" FROM/);
  });
});
