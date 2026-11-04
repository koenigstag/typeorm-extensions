import 'typeorm-extensions/extensions/period-filter.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-period-filter.extension';
import type { PeriodFilter } from 'typeorm-extensions/types/interfaces/period.interface';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

setupTest('period-filter.sql', undefined, (context) => {
  const queryUsers = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  const conditionsAndValues = (period: PeriodFilter, exclusive?: boolean) => {
    const query = queryUsers().applyPeriodFilterTyped((u) => u.createdAt, period, {
      periodToExclusive: exclusive,
    });

    return [query.getQuery().replace(/^.*?WHERE /s, '').replace(/ ORDER BY.*$/s, ''), Object.values(query.getParameters())];
  };

  it('SHOULD add inclusive >= and <= conditions with AND', () => {
    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-31T23:59:59.999Z');

    const query = queryUsers()
      .where('user.id > 0')
      .applyPeriodFilter('user.createdAt', { periodFrom: from, periodTo: to });

    expect(query.getQuery()).toMatch(
      /WHERE user\.id > 0 AND "user"\."createdAt" >= :periodFrom_\w+ AND "user"\."createdAt" <= :periodTo_\w+/,
    );
    expect(Object.values(query.getParameters())).toEqual([from, to]);
  });

  it('SHOULD include the whole day of a date-only periodTo', () => {
    expect(conditionsAndValues({ periodFrom: '2024-01-01', periodTo: '2024-01-31' })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" >= :periodFrom_\w+ AND "user"\."createdAt" < :periodTo_\w+$/),
      ['2024-01-01', '2024-02-01'],
    ]);

    expect(conditionsAndValues({ periodTo: '2024-02-28' })[1]).toEqual(['2024-02-29']);
    expect(conditionsAndValues({ periodTo: '2023-12-31' })[1]).toEqual(['2024-01-01']);
    // no day after: plain <=
    expect(conditionsAndValues({ periodTo: '9999-12-31' })).toEqual([
      expect.stringMatching(/<= :periodTo_\w+$/),
      ['9999-12-31'],
    ]);
  });

  it('SHOULD keep timestamps and Dates as exact inclusive bounds', () => {
    const to = new Date('2024-01-31T00:00:00.000Z');

    expect(conditionsAndValues({ periodTo: to })).toEqual([expect.stringMatching(/<= :periodTo_\w+$/), [to]]);
    expect(conditionsAndValues({ periodTo: '2024-01-31 12:00:00' })).toEqual([
      expect.stringMatching(/<= :periodTo_\w+$/),
      ['2024-01-31 12:00:00'],
    ]);
  });

  it('SHOULD make periodTo exclusive with periodToExclusive', () => {
    expect(conditionsAndValues({ periodFrom: '2024-01-01', periodTo: '2024-02-01' }, true)).toEqual([
      expect.stringMatching(/>= :periodFrom_\w+ AND "user"\."createdAt" < :periodTo_\w+$/),
      ['2024-01-01', '2024-02-01'],
    ]);
  });

  it('SHOULD skip missing, null and empty ends', () => {
    for (const period of [undefined, null, {}, { periodFrom: '', periodTo: undefined }, { periodFrom: null, periodTo: null }]) {
      const query = queryUsers().applyPeriodFilter('user.createdAt', period as PeriodFilter);
      expect(query.getQuery()).not.toMatch(/WHERE/);
    }

    expect(conditionsAndValues({ periodFrom: '2024-01-01' })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" >= :periodFrom_\w+$/),
      ['2024-01-01'],
    ]);
  });

  it('SHOULD throw for invalid dates', () => {
    expect(() => conditionsAndValues({ periodFrom: new Date('nope') })).toThrow(/Invalid periodFrom: invalid Date/);
    expect(() => conditionsAndValues({ periodTo: '2024-02-30' })).toThrow(/Invalid periodTo "2024-02-30"/);
    expect(() => conditionsAndValues({ periodTo: 5 as unknown as string })).toThrow(/expected a Date or a string/);
  });

  it('SHOULD use a bare column on UPDATE / DELETE and throw for several columns', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .applyPeriodFilterTyped((u) => u.createdAt, { periodTo: '2024-01-31' });

    expect(query.getQuery()).toMatch(/^DELETE FROM "users" WHERE "createdAt" < :periodTo_\w+$/);

    expect(() =>
      queryUsers().applyPeriodFilterTyped((u) => [u.createdAt, u.updatedAt], {}),
    ).toThrow(/applyPeriodFilterTyped expects the callback to select a single column, got 2/);
  });
});

setupTest('period-filter.rows', undefined, (context) => {
  // midday UTC, so the day is the same in any time zone within ±11 hours
  const seed = async () => {
    const repository = context.dataSource.getRepository(UserEntity);
    const users = await repository.save(await createFakeUsers({ count: 4 }));
    const days = ['2023-12-31', '2024-01-15', '2024-01-31', '2024-02-01'];

    for (const [i, user] of users.entries()) {
      await repository
        .createQueryBuilder()
        .update()
        .set({ createdAt: new Date(`${days[i]}T12:00:00.000Z`) })
        .where('id = :id', { id: user.id })
        .execute();
    }

    return users;
  };

  const filterIds = async (period: PeriodFilter | null, exclusive?: boolean) =>
    (
      await context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .applyPeriodFilterTyped((u) => u.createdAt, period, { periodToExclusive: exclusive })
        .getMany()
    ).map((user) => user.id);

  it('SHOULD include the last day of a date-only period', async () => {
    const users = await seed();

    expect(await filterIds({ periodFrom: '2024-01-01', periodTo: '2024-01-31' })).toEqual([
      users[1].id,
      users[2].id,
    ]);
  });

  it('SHOULD support open-ended periods, Dates and exclusive ends', async () => {
    const users = await seed();

    expect(await filterIds({ periodFrom: '2024-01-31' })).toEqual([users[2].id, users[3].id]);
    expect(await filterIds({ periodTo: '2023-12-31' })).toEqual([users[0].id]);
    expect(await filterIds(null)).toHaveLength(4);

    expect(
      await filterIds({
        periodFrom: new Date('2024-01-15T12:00:00.000Z'),
        periodTo: new Date('2024-01-31T12:00:00.000Z'),
      }),
    ).toEqual([users[1].id, users[2].id]);

    expect(await filterIds({ periodFrom: '2024-01-01', periodTo: '2024-01-31' }, true)).toEqual([
      users[1].id,
    ]);
  });

  it('SHOULD delete rows of a period', async () => {
    const users = await seed();
    const repository = context.dataSource.getRepository(UserEntity);

    await repository
      .createQueryBuilder()
      .delete()
      .applyPeriodFilterTyped((u) => u.createdAt, { periodTo: '2024-01-15' })
      .execute();

    expect((await repository.find()).map((user) => user.id)).toEqual([users[2].id, users[3].id]);
  });
});
