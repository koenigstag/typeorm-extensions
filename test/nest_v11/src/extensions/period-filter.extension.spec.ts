import 'typeorm-extensions/extensions/period-filter.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-period-filter.extension';
import type { PeriodFilter } from 'typeorm-extensions/types/interfaces/period.interface';
import type { ApplyPeriodOptions } from 'typeorm-extensions/types/extensions/period.types';
import { setupTest, createFakeUsers, sqlOf } from '../test-utils';
import { UserEntity } from '../models';

setupTest('period-filter.sql', undefined, (context) => {
  const queryUsers = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  const conditionsAndValues = (period: PeriodFilter, options?: ApplyPeriodOptions) => {
    const query = queryUsers().applyPeriodFilterTyped((u) => u.createdAt, period, options);

    return [sqlOf(query).replace(/^.*?WHERE /s, '').replace(/ ORDER BY.*$/s, ''), Object.values(query.getParameters())];
  };

  it('SHOULD add inclusive >= and <= conditions with AND', () => {
    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-31T23:59:59.999Z');

    const query = queryUsers()
      .where('user.id > 0')
      .applyPeriodFilter('user.createdAt', { periodFrom: from, periodTo: to });

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."id" > 0 AND "user"\."createdAt" >= :periodFrom_\w+ AND "user"\."createdAt" <= :periodTo_\w+/,
    );
    expect(Object.values(query.getParameters())).toEqual([from, to]);
  });

  it('SHOULD narrow existing OR conditions instead of joining the last of them', () => {
    const query = queryUsers()
      .where('user.id = 1')
      .orWhere('user.id = 2')
      .applyPeriodFilter('user.createdAt', { periodFrom: '2024-01-01', periodTo: '2024-01-31' });

    expect(sqlOf(query)).toMatch(
      /WHERE \("user"\."id" = 1 OR "user"\."id" = 2\) AND "user"\."createdAt" >= :periodFrom_\w+ AND "user"\."createdAt" < :periodTo_\w+/,
    );
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

  it('SHOULD exclude the end with includeTo: false', () => {
    // half-open period
    expect(conditionsAndValues({ periodFrom: '2024-01-01', periodTo: '2024-02-01' }, { includeTo: false })).toEqual([
      expect.stringMatching(/>= :periodFrom_\w+ AND "user"\."createdAt" < :periodTo_\w+$/),
      ['2024-01-01', '2024-02-01'],
    ]);

    const to = new Date('2024-01-31T00:00:00.000Z');
    expect(conditionsAndValues({ periodTo: to }, { includeTo: false })).toEqual([
      expect.stringMatching(/< :periodTo_\w+$/),
      [to],
    ]);
  });

  it('SHOULD exclude the start with includeFrom: false, a date-only start as a whole day', () => {
    expect(conditionsAndValues({ periodFrom: '2024-01-01' }, { includeFrom: false })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" >= :periodFrom_\w+$/),
      ['2024-01-02'],
    ]);

    const from = new Date('2024-01-01T10:00:00.000Z');
    expect(conditionsAndValues({ periodFrom: from }, { includeFrom: false })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" > :periodFrom_\w+$/),
      [from],
    ]);
    expect(conditionsAndValues({ periodFrom: '2024-01-01 10:00:00' }, { includeFrom: false })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" > :periodFrom_\w+$/),
      ['2024-01-01 10:00:00'],
    ]);
  });

  it('SHOULD skip missing, null and empty ends', () => {
    for (const period of [undefined, null, {}, { periodFrom: '', periodTo: undefined }, { periodFrom: null, periodTo: null }]) {
      const query = queryUsers().applyPeriodFilter('user.createdAt', period as PeriodFilter);
      expect(sqlOf(query)).not.toMatch(/WHERE/);
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

  it('SHOULD read dates and date-times without an offset in the timeZone', () => {
    const timeZone = 'America/New_York';

    expect(conditionsAndValues({ periodFrom: '2024-01-01', periodTo: '2024-01-31' }, { timeZone })).toEqual([
      expect.stringMatching(/^"user"\."createdAt" >= :periodFrom_\w+ AND "user"\."createdAt" < :periodTo_\w+$/),
      [new Date('2024-01-01T05:00:00.000Z'), new Date('2024-02-01T05:00:00.000Z')],
    ]);
    // an excluded start day: the next midnight in the zone
    expect(conditionsAndValues({ periodFrom: '2024-01-01' }, { timeZone, includeFrom: false })[1]).toEqual([
      new Date('2024-01-02T05:00:00.000Z'),
    ]);
    expect(conditionsAndValues({ periodTo: '2024-01-31 10:00' }, { timeZone: 'Asia/Kolkata' })).toEqual([
      expect.stringMatching(/<= :periodTo_\w+$/),
      [new Date('2024-01-31T04:30:00.000Z')],
    ]);
  });

  it('SHOULD follow daylight saving time as PostgreSQL does', () => {
    const timeZone = 'America/New_York';

    // a 23-hour day
    expect(conditionsAndValues({ periodFrom: '2024-03-10', periodTo: '2024-03-10' }, { timeZone })[1]).toEqual([
      new Date('2024-03-10T05:00:00.000Z'),
      new Date('2024-03-11T04:00:00.000Z'),
    ]);
    // skipped by the clock: read with the offset before the transition
    expect(conditionsAndValues({ periodFrom: '2024-03-10 02:30' }, { timeZone })[1]).toEqual([
      new Date('2024-03-10T07:30:00.000Z'),
    ]);
    // the clock skips midnight: the day starts at 01:00
    expect(conditionsAndValues({ periodFrom: '2024-09-08' }, { timeZone: 'America/Santiago' })[1]).toEqual([
      new Date('2024-09-08T04:00:00.000Z'),
    ]);
    // shown twice: the later one
    expect(conditionsAndValues({ periodFrom: '2024-11-03 01:30' }, { timeZone })[1]).toEqual([
      new Date('2024-11-03T06:30:00.000Z'),
    ]);
  });

  it('SHOULD keep Dates, turn strings with an offset into their instants, and keep strings without a timeZone', () => {
    const from = new Date('2024-01-01T10:00:00.000Z');

    expect(
      conditionsAndValues({ periodFrom: from, periodTo: '2024-01-31 10:00+0530' }, { timeZone: 'Asia/Tokyo' })[1],
    ).toEqual([from, new Date('2024-01-31T04:30:00.000Z')]);
    expect(conditionsAndValues({ periodFrom: '2024-01-31T10:00:00.250z' }, { timeZone: 'Asia/Tokyo' })[1]).toEqual([
      new Date('2024-01-31T10:00:00.250Z'),
    ]);

    for (const timeZone of [undefined, null, '']) {
      expect(conditionsAndValues({ periodTo: '2024-01-31' }, { timeZone })[1]).toEqual(['2024-02-01']);
    }
  });

  it('SHOULD throw for an unknown timeZone and for strings it can not read', () => {
    expect(() => conditionsAndValues({}, { timeZone: 'Mars/Base' })).toThrow(/Invalid timeZone "Mars\/Base"/);
    expect(() => conditionsAndValues({ periodTo: 'yesterday' }, { timeZone: 'UTC' })).toThrow(
      /Invalid periodTo "yesterday": with timeZone/,
    );
    expect(() => conditionsAndValues({ periodFrom: '2024-01-31 25:00' }, { timeZone: 'UTC' })).toThrow(
      /Invalid periodFrom "2024-01-31 25:00": not a calendar date and time/,
    );
    expect(() => conditionsAndValues({ periodTo: '2024-01-31T10:00+24:00' }, { timeZone: 'UTC' })).toThrow(
      /Invalid periodTo "2024-01-31T10:00\+24:00": not a UTC offset/,
    );
  });

  it('SHOULD use a bare column on UPDATE / DELETE and throw for several columns', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .applyPeriodFilterTyped((u) => u.createdAt, { periodTo: '2024-01-31' });

    expect(sqlOf(query)).toMatch(/^DELETE FROM "users" WHERE "createdAt" < :periodTo_\w+$/);

    expect(() =>
      queryUsers().applyPeriodFilterTyped((u) => [u.createdAt, u.updatedAt], {}),
    ).toThrow(/applyPeriodFilterTyped expects the callback to select a single column, got 2/);
  });
});

setupTest('period-filter.rows', undefined, (context) => {
  // midday UTC, so the day is the same in any time zone within ±11 hours
  const seed = async (
    instants = ['2023-12-31', '2024-01-15', '2024-01-31', '2024-02-01'].map((day) => `${day}T12:00:00.000Z`),
  ) => {
    const repository = context.dataSource.getRepository(UserEntity);
    const users = await repository.save(await createFakeUsers({ count: instants.length }));

    for (const [i, user] of users.entries()) {
      await repository
        .createQueryBuilder()
        .update()
        .set({ createdAt: new Date(instants[i]) })
        .where('id = :id', { id: user.id })
        .execute();
    }

    return users;
  };

  const filterIds = async (period: PeriodFilter | null, options?: ApplyPeriodOptions) =>
    (
      await context.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .applyPeriodFilterTyped((u) => u.createdAt, period, options)
        .getMany()
    ).map((user) => user.id);

  it('SHOULD include the last day of a date-only period', async () => {
    const users = await seed();

    expect(await filterIds({ periodFrom: '2024-01-01', periodTo: '2024-01-31' })).toEqual([
      users[1].id,
      users[2].id,
    ]);
  });

  it('SHOULD support open-ended periods, Dates and excluded ends', async () => {
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

    expect(await filterIds({ periodFrom: '2024-01-01', periodTo: '2024-01-31' }, { includeTo: false })).toEqual([
      users[1].id,
    ]);

    // the whole first day is excluded, the whole last day included
    expect(await filterIds({ periodFrom: '2024-01-15', periodTo: '2024-02-01' }, { includeFrom: false })).toEqual([
      users[2].id,
      users[3].id,
    ]);
  });

  it('SHOULD filter by the days of a time zone', async () => {
    // around midnight in New York, UTC-5 in winter
    const users = await seed([
      '2024-01-31T04:30:00.000Z',
      '2024-01-31T05:30:00.000Z',
      '2024-02-01T04:30:00.000Z',
      '2024-02-01T05:30:00.000Z',
    ]);
    const timeZone = 'America/New_York';

    expect(await filterIds({ periodFrom: '2024-01-31', periodTo: '2024-01-31' }, { timeZone })).toEqual([
      users[1].id,
      users[2].id,
    ]);
    expect(await filterIds({ periodFrom: '2024-01-31 00:30', periodTo: '2024-01-31 23:30' }, { timeZone })).toEqual([
      users[1].id,
      users[2].id,
    ]);
    // as text, each database would read the offset its own way
    expect(
      await filterIds({ periodFrom: '2024-01-31T07:00:00+02:00', periodTo: '2024-02-01T04:30:00Z' }, { timeZone }),
    ).toEqual([users[1].id, users[2].id]);
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
