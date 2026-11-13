import 'typeorm-extensions/extensions/where-is-in.extension';
import 'typeorm-extensions/extensions/where-is-any.extension';
import 'typeorm-extensions/extensions/where-is-distinct-from.extension';
import 'typeorm-extensions/extensions/order-by-array-position.extension';
import { Column, DataSource } from 'typeorm';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { nativeSql, setupTest, sqlOf } from '../test-utils';
import { LegacyColumnsEntity, TicketEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// String fields: a column of a known alias is quoted whatever its name; expressions stay expressions
setupTest('field-identifiers', undefined, (context) => {
  const legacy = () => context.dataSource.getRepository(LegacyColumnsEntity);
  const isPostgres = () => postgresLikeDrivers.includes(context.typeormOptions.type as never);

  const seed = () =>
    legacy().save([
      new LegacyColumnsEntity({ firstName: 'Ann', lastName: 'Lee' }),
      new LegacyColumnsEntity({ firstName: 'Bob', lastName: null }),
      new LegacyColumnsEntity({ firstName: 'Cid', lastName: 'Ode' }),
    ]);

  const names = (rows: LegacyColumnsEntity[]) => rows.map((row) => row.firstName);

  it('SHOULD quote columns with any characters, by database name or property', async () => {
    await seed();

    for (const field of ['l.first-name', 'l.firstName']) {
      const query = legacy().createQueryBuilder('l').whereIsIn(field, ['Ann', 'Cid']);
      expect(sqlOf(query)).toMatch(/WHERE "l"\."first-name" IN \(/);
      expect(names(await query.getMany())).toEqual(['Ann', 'Cid']);
    }

    const unqualified = legacy().createQueryBuilder('l').whereIsIn('first-name', ['Bob']);
    expect(sqlOf(unqualified)).toMatch(/WHERE "first-name" IN \(/);
    expect(names(await unqualified.getMany())).toEqual(['Bob']);
  });

  it('SHOULD not map an unqualified property name, which may be a column of a joined table', () => {
    // TicketEntity.status is the column ticket_status; a bare `status` stays `status`
    const query = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('t')
      .whereIsIn('status', ['open']);

    expect(sqlOf(query)).toMatch(/WHERE "status" IN \(/);
  });

  it('SHOULD quote a column name with a space', async () => {
    await seed();

    const query = legacy().createQueryBuilder('l').whereIsDistinctFrom('l.last name', null);
    expect(sqlOf(query)).toMatch(
      /WHERE ("l"\."last name" IS (DISTINCT FROM |NOT )NULL|NOT \("l"\."last name" <=> NULL\))/,
    );
    expect(names(await query.getMany())).toEqual(['Ann', 'Cid']);
  });

  it('SHOULD keep expressions that only look like names', async () => {
    await seed();

    // not a column of `l`: `l.id` minus 1
    const minus = legacy().createQueryBuilder('l').whereIsIn('l.id-1', [0]);
    expect(sqlOf(minus)).toMatch(/WHERE l\.id-1 IN \(/);
    expect(names(await minus.getMany())).toEqual(['Ann']);

    const lower = legacy().createQueryBuilder('l').whereIsIn(nativeSql('LOWER("l"."first-name")'), ['bob']);
    expect(sqlOf(lower)).toMatch(/WHERE LOWER\("l"\."first-name"\) IN \(/);
    expect(names(await lower.getMany())).toEqual(['Bob']);
  });

  it('SHOULD map renamed properties to their columns', async () => {
    const tickets = context.dataSource.getRepository(TicketEntity);
    await tickets.save([new TicketEntity({ status: 'open', ownerId: 1 }), new TicketEntity({ status: 'done', ownerId: 2 })]);

    const query = tickets.createQueryBuilder('t').whereIsIn('t.status', ['done']).orWhereIsIn('t.ownerId', [1]);
    expect(sqlOf(query)).toMatch(/WHERE "t"\."ticket_status" IN \(.+\) OR "t"\."owner_id" IN \(/);
    expect((await query.getMany()).map((t) => t.status)).toEqual(['open', 'done']);
  });

  it('SHOULD write the column names of the entity a tableHelper is given', async () => {
    await seed();

    const l = tableHelper(LegacyColumnsEntity, 'l', { driver: context.typeormOptions.type });
    const query = legacy()
      .createQueryBuilder('l')
      .where(`${l.firstName} <> :name`, { name: 'Bob' })
      .andWhere(l.isNotNull('lastName'))
      .orderBy(l.firstName, 'DESC');

    expect(sqlOf(query)).toMatch(/WHERE ["`]l["`]\.["`]first-name["`] <> .+ AND ["`]l["`]\.["`]last name["`] IS NOT NULL/);
    expect(names(await query.getMany())).toEqual(['Cid', 'Ann']);
  });

  it('SHOULD give the bare column on UPDATE / DELETE', async () => {
    await seed();

    const update = legacy()
      .createQueryBuilder('l')
      .update()
      .set({ lastName: 'X' })
      .whereIsIn('l.first-name', ['Bob']);
    expect(sqlOf(update)).toMatch(/WHERE "first-name" IN \(/);
    await update.execute();

    await legacy().createQueryBuilder('l').delete().whereIsIn('first-name', ['Ann']).execute();

    expect((await legacy().find()).map((row) => [row.firstName, row.lastName])).toEqual([
      ['Bob', 'X'],
      ['Cid', 'Ode'],
    ]);
  });

  it('SHOULD work for the PostgreSQL methods', async () => {
    if (!isPostgres()) return;
    await seed();

    const result = await legacy()
      .createQueryBuilder('l')
      .whereIsAny('l.first-name', ['Ann', 'Cid'])
      .orderByArrayPosition('l.first-name', ['Cid', 'Ann'])
      .getMany();

    expect(names(result)).toEqual(['Cid', 'Ann']);
  });

  it('SHOULD quote with backticks on MySQL when there is no metadata', () => {
    // SQL generation only: the data source is never connected
    const sql = new DataSource({ type: 'mysql' })
      .createQueryBuilder()
      .select('t.id')
      .from('tickets', 't')
      .whereIsIn('t.owner_id', [1])
      .getQuery();

    expect(sql).toMatch(/WHERE `t`\.`owner_id` IN \(/);
  });
});

describe('tableHelper column names', () => {
  type Legacy = { 'first-name': string; 'say "hi"': string; id: number };

  it('SHOULD always quote the column as one identifier', () => {
    const l = tableHelper<Legacy>('l');

    expect(l.column('first-name')).toBe('"l"."first-name"');
    expect(l.column('say "hi"')).toBe('"l"."say ""hi"""');
    expect(tableHelper<Legacy>().column('first-name')).toBe('"first-name"');
    expect(tableHelper<Legacy>('l', { useQuotes: false }).column('first-name')).toBe('l.first-name');
  });

  it('SHOULD quote an alias that is not a plain identifier as one name', () => {
    const t = tableHelper<Legacy>('user-1');

    expect(t.column('id')).toBe('"user-1"."id"');
    expect(tableHelper<Legacy>('public.users').column('id')).toBe('"public"."users"."id"');
  });

  it('SHOULD take the nearest @Column({ name }) of an entity and its parents', () => {
    abstract class Stamped {
      @Column({ type: 'varchar', name: 'created_on' })
      public createdAt: string;

      @Column({ type: 'varchar', name: 'base_code' })
      public code: string;
    }

    class Child extends Stamped {
      @Column({ type: 'varchar', name: 'child_code' })
      public code = '';

      @Column({ type: 'varchar' })
      public title: string;
    }

    const c = tableHelper(Child, 'c');

    expect([c.createdAt, c.code, c.title]).toEqual(['"c"."created_on"', '"c"."child_code"', '"c"."title"']);
    expect(tableHelper(Stamped, 's').code).toBe('"s"."base_code"');
    expect(tableHelper(Child, 'c', { useQuotes: false }).createdAt).toBe('c.created_on');
    expect(tableHelper(Child).column('code', 'x')).toBe('"x"."child_code"');
  });

  it('SHOULD throw for an entity class that is undefined, not take the alias for options', () => {
    const notYetLoaded = undefined as unknown as typeof LegacyColumnsEntity;

    expect(() => tableHelper(notYetLoaded, 'l')).toThrow(/entity class is undefined/);
  });
});
