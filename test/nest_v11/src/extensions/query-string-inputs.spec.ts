import 'typeorm-extensions/extensions/order.extension';
import 'typeorm-extensions/extensions/pagination.extension';
import 'typeorm-extensions/extensions/get-many-with-totals.extension';
import 'typeorm-extensions/extensions/where-is-in.extension';
import 'typeorm-extensions/extensions/where-is-any.extension';
import 'typeorm-extensions/extensions/join-unnest.extension';
import 'typeorm-extensions/extensions/period-filter.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { postgresLikeDrivers, sqliteDrivers } from '../constants/database';
import { disableStrictOrderInput, enableStrictOrderInput, InvalidOrderError } from 'typeorm-extensions/helpers';
import { setupTest, createFakeUsers, createFakeImages, mysqlRun, nativeSql, sqlOf } from '../test-utils';
import { ImageEntity, PersonEntity, TicketEntity, UserEntity } from '../models';

// what a query string hands over: text, one value for a list, an object for a list or an order
setupTest('query-string inputs', undefined, (context) => {
  const driverIn = (drivers: readonly string[]) => drivers.includes(context.typeormOptions.type as never);
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');
  const tickets = () => context.dataSource.getRepository(TicketEntity).createQueryBuilder('t');
  const seedUsers = async (count: number) =>
    context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count }));
  const sortedIds = (rows: { id: number }[]) => rows.map((row) => row.id).sort((a, b) => a - b);

  describe('applyOrder', () => {
    const q = mysqlRun ? '`' : '"';

    it('SHOULD quote a field or a table alias that is more than one identifier as one identifier', async () => {
      await seedUsers(3);

      const byField = users().applyOrder({ field: `${q}id${q} * (SELECT -1), ${q}id${q}`, direction: 'asc' });
      const byAlias = users().applyOrder({ field: 'id', tableAlias: `${q}user${q}.${q}id${q} * (SELECT -1), ${q}user${q}` });

      expect(sqlOf(byField)).toContain('ORDER BY """id"" * (SELECT -1), ""id""" ASC');
      expect(sqlOf(byAlias)).toContain('ORDER BY """user"".""id"" * (SELECT -1), ""user""".');

      // SQLite builds that allow double-quoted strings read an unknown quoted name as a string: a constant order
      if (!driverIn(sqliteDrivers)) {
        await expect(byField.getMany()).rejects.toThrow();
        await expect(byAlias.getMany()).rejects.toThrow();
      }
    });

    it('SHOULD quote again a table alias quoted for another database', async () => {
      await seedUsers(1);

      const other = mysqlRun ? '"' : '`';
      const tableAlias = `${other}\\${other}.${other} OR 1 = 1 -- ${other}`;
      const query = users().applyOrder({ field: 'id', tableAlias });

      // the driver's own quotes: sqlOf would turn MySQL's backticks into the double quotes it was given
      expect(query.getQuery()).toContain(nativeSql('ORDER BY "\\"." OR 1 = 1 -- "."id"'));

      if (!driverIn(sqliteDrivers)) {
        await expect(query.getMany()).rejects.toThrow();
      }
    });

    it('SHOULD take only column names with useQuotes: false', () => {
      expect(() => users().applyOrder({ field: 'id DESC, (SELECT 1)' }, { useQuotes: false })).toThrow(TypeError);
      expect(() => users().applyOrder({ field: 'id', tableAlias: 'user; --' }, { useQuotes: false })).toThrow(TypeError);
      expect(sqlOf(users().applyOrder({ field: 'firstName' }, { useQuotes: false, alias: 'user' }))).toContain(
        'ORDER BY "user"."firstName" ASC',
      );
    });

    it('SHOULD order pages of entities with a joined collection by take and skip', async () => {
      const saved = await seedUsers(4);

      for (const user of saved) {
        await context.dataSource
          .getRepository(ImageEntity)
          .save(await createFakeImages({ count: 2, getOverrides: (index) => ({ id: user.id * 10 + index, userId: user.id }) }));
      }

      const page = await users()
        .leftJoinAndSelect('user.images', 'images')
        .applyOrderFilter({ orderBy: [{ field: 'id', direction: 'desc' }] }, { alias: 'user', resetPreviousOrder: true })
        .applyPagination({ page: 1, pageSize: 2 }, { useTakeAndSkip: true })
        .getMany();

      expect(page.map((user) => user.id)).toEqual(sortedIds(saved).reverse().slice(0, 2));
      expect(page.map((user) => user.images?.length)).toEqual([2, 2]);
    });

    it('SHOULD read isReversed given as 1 / 0 and as their text', () => {
      const direction = (isReversed: unknown) =>
        /ORDER BY "user"\."id" (ASC|DESC)/.exec(sqlOf(users().applyOrder({ field: 'id', isReversed } as never)))?.[1];

      expect([1, '1', 0, '0', 'true', 'false'].map(direction)).toEqual(['DESC', 'DESC', 'ASC', 'ASC', 'DESC', 'ASC']);
    });

    it('SHOULD take one order given as an object, and no order filter at all', () => {
      expect(sqlOf(users().applyOrderFilter({ orderBy: { field: 'id', direction: 'desc' } } as never))).toContain(
        'ORDER BY "user"."id" DESC',
      );
      expect(sqlOf(users().applyOrderFilter(undefined as never))).toBe(sqlOf(users()));
    });

    it('SHOULD throw a TypeError for an order without a field', () => {
      expect(() => users().applyOrder({ direction: 'asc' } as never)).toThrow(TypeError);
      expect(() => users().applyOrderFilter({ orderBy: ['id'] } as never)).toThrow(InvalidOrderError);
    });

    it('SHOULD take the orders themselves as well as an order filter', () => {
      const orders = [{ field: 'firstName' }, { field: 'id', direction: 'desc' as const }];

      expect(sqlOf(users().applyOrderFilter(orders))).toBe(sqlOf(users().applyOrderFilter({ orderBy: orders })));
      expect(sqlOf(users().applyOrderFilter(orders[1]))).toBe(sqlOf(users().applyOrderFilter({ orderBy: [orders[1]] })));
    });

    it('SHOULD refuse a name or a NULLS order it does not read, with strict order input on', () => {
      const errorOf = (build: () => unknown): unknown => {
        try {
          build();
        } catch (error) {
          return error;
        }

        return undefined;
      };

      enableStrictOrderInput();

      try {
        expect(errorOf(() => users().applyOrder({ field: `${q}id${q} * (SELECT -1), ${q}id${q}` }))).toMatchObject({ part: 'field' });
        expect(errorOf(() => users().applyOrder({ field: 'id', tableAlias: 'user; --' }))).toMatchObject({ part: 'tableAlias' });
        expect(errorOf(() => users().applyOrderFilter([{ field: 'firstName', nulls: 'firstly' as 'first' }]))).toMatchObject({
          part: 'nulls',
          value: 'firstly',
        });
        expect(errorOf(() => users().applyOrder({ field: 'id', nulls: '' as 'first' }))).toBeInstanceOf(InvalidOrderError);
        expect(() => users().applyOrder({ field: 'firstName', tableAlias: 'user', nulls: 'last', isReversed: 'maybe' as never })).not.toThrow();
        // a dotted field is an embedded column's path or nothing: quoted as one name, it names no column
        expect(errorOf(() => users().applyOrder({ field: 'user.firstName' }))).toMatchObject({ part: 'field', value: 'user.firstName' });
        expect(errorOf(() => users().applyOrder({ field: 'firstName', tableAlias: 'user.profile' }))).toMatchObject({ part: 'tableAlias' });
        expect(() => context.dataSource.getRepository(PersonEntity).createQueryBuilder('p').applyOrder({ field: 'address.city', tableAlias: 'p' })).not.toThrow();
      } finally {
        disableStrictOrderInput();
      }

      expect(() => users().applyOrder({ field: 'id', tableAlias: 'user; --', nulls: 'firstly' as 'first' })).not.toThrow();
    });

    it('SHOULD put NULLs first or last on every database', async () => {
      await context.dataSource
        .getRepository(TicketEntity)
        .save([
          new TicketEntity({ status: 'b', ownerId: 2 }),
          new TicketEntity({ status: 'none', ownerId: null }),
          new TicketEntity({ status: 'a', ownerId: 1 }),
        ]);

      const statuses = async (direction: 'asc' | 'desc', nulls: string) =>
        (await tickets().applyOrder({ field: 'ownerId', direction, nulls } as never, { alias: 't' }).getMany()).map(
          (ticket) => ticket.status,
        );

      expect(await statuses('asc', 'last')).toEqual(['a', 'b', 'none']);
      expect(await statuses('asc', 'first')).toEqual(['none', 'a', 'b']);
      expect(await statuses('desc', 'NULLS LAST')).toEqual(['b', 'a', 'none']);
      expect(await statuses('desc', 'first')).toEqual(['none', 'b', 'a']);
    });
  });

  describe('pagination', () => {
    it('SHOULD read the first page without a pagination filter', async () => {
      await seedUsers(3);

      const result = await users().getManyWithTotals(undefined as never);

      expect(result).toMatchObject({ total: 3, page: 1 });
      expect(result.list).toHaveLength(3);
      expect(() => users().applyPagination(null as never)).not.toThrow();
    });
  });

  describe('value lists', () => {
    it('SHOULD read one value given as text, and a list given as an object', async () => {
      const saved = await seedUsers(3);
      const [a, b, c] = [...saved].sort((x, y) => x.id - y.id);
      const found = async (query: ReturnType<typeof users>) => sortedIds(await query.getMany());

      expect(await found(users().whereIsIn('user.email', b.email as never))).toEqual([b.id]);
      expect(await found(users().whereIsIn('user.email', { 0: a.email, 1: c.email } as never))).toEqual([a.id, c.id]);
      expect(await found(users().whereIsNotIn('user.id', b.id as never))).toEqual([a.id, c.id]);
      expect(await found(users().whereIsNotInTyped((u) => u.id, { 0: a.id } as never))).toEqual([b.id, c.id]);
      expect(await found(users().whereIsNotIn('user.id', '' as never))).toEqual([a.id, b.id, c.id]);
    });

    it('SHOULD throw a TypeError for a value that is not a list', () => {
      expect(() => users().whereIsIn('user.id', { ids: [1] } as never)).toThrow(TypeError);
      expect(() => users().whereIsNotAny('user.id', new Map() as never)).toThrow(TypeError);
      expect(() => users().innerJoinUnnest('user.id', { ids: [1] } as never)).toThrow(TypeError);
    });

    it('SHOULD bind one value given as text as an array for ANY and unnest', async () => {
      if (!driverIn(postgresLikeDrivers)) {
        return;
      }

      const [, b] = await seedUsers(2);

      expect(sortedIds(await users().whereIsAny('user.email', b.email as never).getMany())).toEqual([b.id]);
      expect(sortedIds(await users().innerJoinUnnest('user.email', b.email as never, 'text[]').getMany())).toEqual([b.id]);
    });
  });

  describe('applyPeriodFilter', () => {
    it('SHOULD compare an ISO string with an offset as a point in time on SQLite', async () => {
      if (!driverIn(sqliteDrivers)) {
        return;
      }

      const [user] = await seedUsers(1);
      const { createdAt } = await context.dataSource.getRepository(UserEntity).findOneByOrFail({ id: user.id });
      const iso = (shiftMs: number) => new Date(createdAt.getTime() + shiftMs).toISOString();

      expect(sortedIds(await users().applyPeriodFilter('user.createdAt', { periodFrom: iso(-1000) }).getMany())).toEqual([user.id]);
      expect(await users().applyPeriodFilter('user.createdAt', { periodFrom: iso(1000) }).getMany()).toEqual([]);
      expect(sortedIds(await users().applyPeriodFilter('user.createdAt', { periodTo: iso(1000) }).getMany())).toEqual([user.id]);
      expect(await users().applyPeriodFilter('user.createdAt', { periodTo: iso(-1000) }).getMany()).toEqual([]);
    });
  });
});
