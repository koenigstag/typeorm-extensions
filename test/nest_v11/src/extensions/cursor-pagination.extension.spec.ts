import 'typeorm-extensions/extensions/cursor-pagination.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { InvalidCursorError } from 'typeorm-extensions/extensions/cursor-pagination.extension';
import type { GetManyWithCursorOptions, ListWithCursor } from 'typeorm-extensions/types/extensions/cursor-pagination.types';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { setupTest, createFakeUsers, createFakeImages, sqlOf } from '../test-utils';
import { ImageEntity, TicketEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

/** Loads every page and returns the pages; fails on a loop. */
async function walk<Entity extends ObjectLiteral>(
  query: () => SelectQueryBuilder<Entity>,
  options: GetManyWithCursorOptions<Entity>,
  pageSize: number,
): Promise<Entity[][]> {
  const pages: Entity[][] = [];
  let cursor: string | null = null;

  do {
    const page: ListWithCursor<Entity> = await query().getManyWithCursor({ cursor, pageSize }, options);
    pages.push(page.list);
    cursor = page.nextCursor;

    if (pages.length > 100) {
      throw new Error('too many pages');
    }
  } while (cursor);

  return pages;
}

const ids = (rows: { id: number }[]) => rows.map((row) => row.id);

setupTest('cursor-pagination', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity);

  const seedUsers = async (count: number) => {
    const saved = await users().save(await createFakeUsers({ count }));
    // a few distinct days, several users per day: ties must be broken by the primary key
    for (const [i, user] of saved.entries()) {
      await users()
        .createQueryBuilder()
        .update()
        .set({ createdAt: new Date(Date.UTC(2024, 0, 1 + (i % 3), 12)) })
        .where('id = :id', { id: user.id })
        .execute();
    }

    return saved;
  };

  it('SHOULD walk all rows once, in order, with ties on the key', async () => {
    await seedUsers(7);

    const expected = await users()
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .getMany();

    const pages = await walk(
      () => users().createQueryBuilder('user'),
      { orderBy: [{ field: 'createdAt', direction: 'DESC' }] },
      3,
    );

    expect(pages.map((page) => page.length)).toEqual([3, 3, 1]);
    expect(ids(pages.flat())).toEqual(ids(expected));
  });

  it('SHOULD support mixed directions', async () => {
    await seedUsers(7);

    const expected = await users()
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'ASC')
      .addOrderBy('user.id', 'DESC')
      .getMany();

    const pages = await walk(
      () => users().createQueryBuilder('user'),
      { orderBy: [{ field: 'createdAt', direction: 'asc' }, { field: 'id', direction: -1 }] },
      2,
    );

    expect(ids(pages.flat())).toEqual(ids(expected));
  });

  it('SHOULD return no cursor on the last page, also when it is full', async () => {
    await seedUsers(4);

    const first = await users()
      .createQueryBuilder('user')
      .getManyWithCursor({ pageSize: 4 }, { orderBy: [{ field: 'id' }] });
    expect(first.list).toHaveLength(4);
    expect(first.nextCursor).toBeNull();
    expect(first.hasMore).toBe(false);

    const empty = await users()
      .createQueryBuilder('user')
      .where('1 = 0')
      .getManyWithCursor(null, { orderBy: [] });
    expect(empty).toEqual({ list: [], nextCursor: null, hasMore: false });
  });

  it('SHOULD report hasMore on every page, in step with nextCursor', async () => {
    await seedUsers(5);
    const query = () => users().createQueryBuilder('user');
    const options = { orderBy: [{ field: 'id' as const }] };

    const seen: Array<{ hasMore: boolean; hasCursor: boolean }> = [];
    let cursor: string | null = null;

    do {
      const page: ListWithCursor<UserEntity> = await query().getManyWithCursor({ cursor, pageSize: 2 }, options);
      seen.push({ hasMore: page.hasMore, hasCursor: page.nextCursor !== null });
      cursor = page.nextCursor;
    } while (cursor);

    // 5 rows at 2 per page: two full pages with a next one, then the last page of one row
    expect(seen).toEqual([
      { hasMore: true, hasCursor: true },
      { hasMore: true, hasCursor: true },
      { hasMore: false, hasCursor: false },
    ]);
  });

  it('SHOULD keep the conditions of the query, OR included', async () => {
    const saved = await seedUsers(6);
    const wanted = [saved[0].id, saved[2].id, saved[4].id];

    const pages = await walk(
      () =>
        users()
          .createQueryBuilder('user')
          .where('user.id = :a', { a: wanted[0] })
          .orWhere('user.id IN (:...b)', { b: wanted.slice(1) }),
      { orderBy: [{ field: 'id' }] },
      1,
    );

    expect(ids(pages.flat())).toEqual(wanted);
  });

  it('SHOULD not shift pages when rows are inserted meanwhile', async () => {
    await seedUsers(4);
    const query = () => users().createQueryBuilder('user');
    const options = { orderBy: [{ field: 'id' as const, direction: 'DESC' as const }] };

    const first = await query().getManyWithCursor({ pageSize: 2 }, options);
    await users().save(await createFakeUsers({ count: 2 }));
    const second = await query().getManyWithCursor({ cursor: first.nextCursor, pageSize: 2 }, options);

    const all = await users().find({ order: { id: 'DESC' } });
    // the new rows are before the first page: the second page continues where the first ended
    expect(ids(second.list)).toEqual(ids(all.slice(-2)));
  });

  it('SHOULD page queries with joined collections with useTakeAndSkip', async () => {
    const saved = await seedUsers(5);
    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 6,
        getOverrides: (i) => ({ id: i + 1, userId: saved[i % 3].id }),
      }),
    );

    const pages = await walk(
      () => users().createQueryBuilder('user').leftJoinAndSelectTyped((u) => u.images, 'images'),
      { orderBy: [{ field: 'createdAt', direction: 'DESC' }], useTakeAndSkip: true },
      2,
    );

    const visited = pages.flat();
    expect(new Set(ids(visited)).size).toBe(5);
    expect(visited).toHaveLength(5);
    expect(visited.find((user) => user.id === saved[0].id)?.images).toHaveLength(2);
  });

  it('SHOULD map properties to database column names', async () => {
    const tickets = context.dataSource.getRepository(TicketEntity);
    await tickets.save(
      ['b', 'a', 'c', 'a', 'b'].map((status) => new TicketEntity({ status, ownerId: null })),
    );

    const pages = await walk(
      () => tickets.createQueryBuilder('t'),
      { orderBy: [{ field: 'status' }] },
      2,
    );

    expect(pages.flat().map((ticket) => ticket.status)).toEqual(['a', 'a', 'b', 'b', 'c']);
  });

  it('SHOULD not change the query builder', async () => {
    await seedUsers(3);
    const query = users().createQueryBuilder('user').where('user.id > 0');
    const before = sqlOf(query);

    await query.getManyWithCursor({ pageSize: 1 }, { orderBy: [{ field: 'createdAt' }] });

    expect(sqlOf(query)).toBe(before);
  });

  it('SHOULD reject invalid cursors and unknown fields', async () => {
    await seedUsers(3);
    const { nextCursor } = await users()
      .createQueryBuilder('user')
      .getManyWithCursor({ pageSize: 1 }, { orderBy: [{ field: 'createdAt' }] });

    const load = (cursor: string, field: 'createdAt' | 'email' = 'createdAt') =>
      users().createQueryBuilder('user').getManyWithCursor({ cursor }, { orderBy: [{ field }] });

    await expect(load('not a cursor!')).rejects.toBeInstanceOf(InvalidCursorError);
    await expect(load('eyJrIjoxfQ')).rejects.toBeInstanceOf(InvalidCursorError);
    // a cursor of another order
    await expect(load(nextCursor as string, 'email')).rejects.toThrow(/not made for the order \(email, id\)/);

    await expect(
      users()
        .createQueryBuilder('user')
        .getManyWithCursor({}, { orderBy: [{ field: 'images' as never }] }),
    ).rejects.toThrow(/"images" is not a column of UserEntity/);
  });
});

setupTest('cursor-pagination.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD keep microsecond precision of timestamps', async () => {
    const users = context.dataSource.getRepository(UserEntity);
    const saved = await users.save(await createFakeUsers({ count: 5 }));

    // all within the same millisecond: a cursor from a JS Date would skip all but the first
    for (const [i, user] of saved.entries()) {
      await context.dataSource.query(`UPDATE users SET "createdAt" = $1 WHERE id = $2`, [
        `2024-01-01 00:00:00.12340${i}`,
        user.id,
      ]);
    }

    const pages = await walk(
      () => users.createQueryBuilder('user'),
      { orderBy: [{ field: 'createdAt', direction: 'DESC' }] },
      1,
    );

    expect(ids(pages.flat())).toEqual(ids(saved).reverse());
  });
});
