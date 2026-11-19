import 'typeorm-extensions/extensions/cursor-pagination.extension';
import 'typeorm-extensions/extensions/get-many-with-totals.extension';
import 'typeorm-extensions/extensions/period-filter.extension';
import 'typeorm-extensions/extensions/calculated-column.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/union.extension';
import 'typeorm-extensions/extensions/where-exists.extension';
import { Entity, PrimaryColumn } from 'typeorm';
import { InvalidCursorError } from 'typeorm-extensions/extensions/cursor-pagination.extension';
import { postgresLikeDrivers } from '../constants/database';
import { dateColumn } from '../constants/columns';
import { setupTest, createFakeUsers, createFakeImages, nativeSql, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

@Entity({ name: 'readings' })
class ReadingEntity {
  constructor(partial: Partial<ReadingEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryColumn({ type: 'integer' })
  public id!: number;

  @PrimaryColumn({ type: dateColumn })
  public takenAt!: Date;
}

const sortedIds = (rows: { id: number }[]) => rows.map((row) => row.id).sort((a, b) => a - b);

setupTest('query shapes', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  const seedUsers = async (count: number) =>
    sortedIds(await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count })));

  const seedImages = async (images: { id: number; userId: number; url: string }[]) =>
    context.dataSource
      .getRepository(ImageEntity)
      .save(await createFakeImages({ count: images.length, getOverrides: (index) => images[index] }));

  const walk = async (query: () => ReturnType<typeof users>, orderBy: { field: 'id'; direction?: 'ASC' | 'DESC' }[]) => {
    const ids: number[] = [];
    let cursor: string | null | undefined;

    for (let page = 0; page < 10; page++) {
      const result = await query().getManyWithCursor({ pageSize: 1, cursor }, { orderBy });
      ids.push(...result.list.map((user) => user.id));
      cursor = result.nextCursor;

      if (!cursor) {
        break;
      }
    }

    return ids;
  };

  describe('a narrowing condition after a raw OR', () => {
    it('SHOULD narrow a where written with OR in one string, on select and delete', async () => {
      const [a, b] = await seedUsers(3);
      const either = 'user.id = :a OR user.id = :b';

      expect(await users().where(either, { a, b }).applyPeriodFilter('user.createdAt', { periodTo: '2020-01-01' }).getMany()).toEqual([]);

      const deleted = await context.dataSource
        .createQueryBuilder()
        .delete()
        .from(UserEntity)
        .where('id = :a OR id = :b', { a, b })
        .applyPeriodFilter('createdAt', { periodTo: '2020-01-01' })
        .execute();

      expect(deleted.affected ?? 0).toBe(0);
      expect(await context.dataSource.getRepository(UserEntity).count()).toBe(3);
    });

    it('SHOULD walk the pages of a query with a raw OR to the end', async () => {
      const [a, , c] = await seedUsers(3);

      expect(await walk(() => users().where('user.id = :a OR user.id = :c', { a, c }), [{ field: 'id' }])).toEqual([a, c]);
    });
  });

  it('SHOULD keep each factory parameter of addSelectCalculated', async () => {
    const [userId] = await seedUsers(1);
    await seedImages([
      { id: 1, userId, url: 'a' },
      { id: 2, userId, url: 'a' },
      { id: 3, userId, url: 'b' },
    ]);

    const countByUrl = (url: string) => (qb: ReturnType<typeof users>) =>
      qb
        .select('COUNT(*)')
        .from(ImageEntity, 'i')
        .where(`i.userId = ${nativeSql('"user"."id"')} AND i.url = :url`, { url })
        .setOption('disable-global-order');

    const [user] = await users()
      .addSelectCalculated(countByUrl('a') as never, 'imagesCount')
      .addSelectCalculated(countByUrl('b') as never, 'imagesCountInteger')
      .getMany();

    expect([user.imagesCount, user.imagesCountInteger]).toEqual([2, 1]);
  });

  it('SHOULD read a typed key named like a method of the key holder', () => {
    const query = users().whereTyped((u) => (u as unknown as { push: boolean }).push, '=', true as never);

    expect(sqlOf(query)).toMatch(/"user"\."push" = :where_\w+/);
  });

  it('SHOULD read a page past the last offset as an empty page', async () => {
    await seedUsers(3);

    const result = await users().getManyWithTotals({ page: '1e21' as never, pageSize: 2 });

    expect(result).toMatchObject({ list: [], total: 3, hasMore: false });
  });

  it('SHOULD refuse a cursor made for the opposite direction', async () => {
    await seedUsers(3);

    const { nextCursor } = await users().getManyWithCursor({ pageSize: 1 }, { orderBy: [{ field: 'id', direction: 'DESC' }] });

    await expect(
      users().getManyWithCursor({ pageSize: 1, cursor: nextCursor }, { orderBy: [{ field: 'id', direction: 'ASC' }] }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it('SHOULD take a union part with a common table expression in any position', async () => {
    const userIds = await seedUsers(2);
    const seven = context.dataSource
      .createQueryBuilder()
      .addCommonTableExpression(`SELECT 7 AS ${nativeSql('"id"')}`, 'seven')
      .select('seven.id', 'id')
      .from('seven', 'seven');

    const rows = await context.dataSource
      .createQueryBuilder()
      .fromUnion([users().select('user.id', 'id'), seven], 'u')
      .select('u.id', 'id')
      .getRawMany<{ id: number | string }>();

    expect(rows.map(({ id }) => Number(id)).sort((x, y) => x - y)).toEqual([...userIds, 7]);
  });

  it('SHOULD keep the select aliases a HAVING names in NOT EXISTS', async () => {
    if (postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      // PostgreSQL itself refuses a select alias in HAVING
      return;
    }

    const [one, two, three] = await seedUsers(3);
    await seedImages([
      { id: 1, userId: one, url: 'a' },
      { id: 2, userId: one, url: 'b' },
      { id: 3, userId: two, url: 'c' },
    ]);

    const severalImages = context.dataSource
      .createQueryBuilder()
      .select('i.userId', 'userId')
      .addSelect('COUNT(*)', 'cnt')
      .from(ImageEntity, 'i')
      .where(`i.userId = ${nativeSql('"user"."id"')}`)
      .groupBy('i.userId')
      .having('cnt > 1');

    expect(sortedIds(await users().andWhereNotExists(severalImages).getMany())).toEqual([two, three]);
  });

  it('SHOULD count raw rows whose columns share a name', async () => {
    const [userId] = await seedUsers(1);
    await seedImages([
      { id: 1, userId, url: 'a' },
      { id: 2, userId, url: 'b' },
    ]);

    const result = await context.dataSource
      .createQueryBuilder()
      .select('*')
      .from(ImageEntity, 'i')
      .innerJoin(UserEntity, 'u', 'u.id = i.userId')
      .getRawManyWithTotals({ pageSize: 10 });

    expect(result.total).toBe(2);
  });
});

setupTest('cursor over a date in the primary key', { entities: [ReadingEntity] }, (context) => {
  it('SHOULD find the last row of a page when the primary key holds a date', async () => {
    await context.dataSource.getRepository(ReadingEntity).save([
      new ReadingEntity({ id: 1, takenAt: new Date('2026-01-01T00:00:01Z') }),
      new ReadingEntity({ id: 2, takenAt: new Date('2026-01-01T00:00:02Z') }),
      new ReadingEntity({ id: 3, takenAt: new Date('2026-01-01T00:00:03Z') }),
    ]);

    const ids: number[] = [];
    let cursor: string | null | undefined;

    for (let page = 0; page < 5; page++) {
      const result = await context.dataSource
        .getRepository(ReadingEntity)
        .createQueryBuilder('r')
        .getManyWithCursor({ pageSize: 1, cursor }, { orderBy: [{ field: 'takenAt', direction: 'DESC' }] });

      ids.push(...result.list.map((reading) => reading.id));
      cursor = result.nextCursor;

      if (!cursor) {
        break;
      }
    }

    expect(ids).toEqual([3, 2, 1]);
  });
});
