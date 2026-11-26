import 'typeorm-extensions';
import { Column, DataSource, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { DatabaseType } from 'typeorm';
import {
  disableUnboundParameterGuard,
  enableUnboundParameterGuard,
  findUnboundParameters,
  UnboundParameterError,
} from 'typeorm-extensions';
import { setupTest } from '../test-utils';

@Entity({ name: 'unbound_guard_users' })
class UnboundGuardUserEntity {
  constructor(partial: Partial<UnboundGuardUserEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar' })
  public email: string;

  @Column({ type: 'varchar' })
  public status: string;

  @DeleteDateColumn()
  public deletedAt?: Date | null;
}

const entities = [UnboundGuardUserEntity];

/** A condition that names a parameter it doesn't pass, on every kind of builder. */
const unboundQueries = (dataSource: DataSource) => {
  const condition = 'email = :login';

  return {
    select: () => dataSource.getRepository(UnboundGuardUserEntity).createQueryBuilder('u').where(condition),
    insert: () =>
      dataSource
        .createQueryBuilder()
        .insert()
        .into(UnboundGuardUserEntity)
        .values({ email: () => ':login', status: 'new' }),
    update: () =>
      dataSource.createQueryBuilder().update(UnboundGuardUserEntity).set({ status: 'paid' }).where(condition),
    remove: () => dataSource.createQueryBuilder().delete().from(UnboundGuardUserEntity).where(condition),
    softDelete: () => dataSource.createQueryBuilder(UnboundGuardUserEntity, 'u').softDelete().where(condition),
    restore: () => dataSource.createQueryBuilder(UnboundGuardUserEntity, 'u').restore().where(condition),
  };
};

const errorOf = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
};

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

afterEach(() => disableUnboundParameterGuard());

// SQL generation only: the data source is never connected, so a query that got past the guard fails to connect
describe('unbound parameter guard', () => {
  let pg: DataSource;

  beforeAll(async () => {
    pg = new DataSource({ type: 'postgres', entities });
    // metadata without a connection, as initialize() builds it
    await (pg as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  it('SHOULD throw from getSql() for a parameter without a value, naming it and the fix', () => {
    enableUnboundParameterGuard();

    const thrown = errorOf(() => unboundQueries(pg).select().getSql()) as UnboundParameterError;

    expect(thrown).toBeInstanceOf(UnboundParameterError);
    expect(thrown.parameters).toEqual([
      { name: 'login', spread: false, index: expect.any(Number), snippet: expect.stringContaining('email = :login') },
    ]);
    expect(thrown.sql).toContain('email = :login');
    expect(thrown.message).toContain(':login in ');
    expect(thrown.message).toContain(`setParameter('login', value)`);
  });

  it('SHOULD report only the parameters without a value when others have one', () => {
    enableUnboundParameterGuard();

    const query = pg
      .getRepository(UnboundGuardUserEntity)
      .createQueryBuilder('u')
      .whereTyped((u) => u.status, '=', 'new')
      .andWhere('u.email = :login')
      .andWhere('u.id IN (:...ids)');

    const thrown = errorOf(() => query.getSql()) as UnboundParameterError;

    expect(thrown).toBeInstanceOf(UnboundParameterError);
    expect(thrown.sql).toContain('"u"."status" = $1');
    expect(thrown.parameters.map(({ name, spread }) => [name, spread])).toEqual([
      ['login', false],
      ['ids', true],
    ]);
    expect(thrown.message).toContain(':...ids in ');

    expect(() => query.setParameters({ login: 'a@b.c', ids: [1, 2] }).getSql()).not.toThrow();
  });

  it.each(['getMany', 'getOne', 'getRawMany', 'getRawOne', 'getCount', 'getManyAndCount', 'stream'] as const)(
    'SHOULD reject %s() with the guard error before the query runs',
    async (method) => {
      enableUnboundParameterGuard();

      await expect(unboundQueries(pg).select()[method]()).rejects.toThrow(UnboundParameterError);
    },
  );

  it.each(['insert', 'update', 'remove', 'softDelete', 'restore'] as const)(
    'SHOULD reject execute() of %s queries with the guard error',
    async (kind) => {
      enableUnboundParameterGuard();

      const query = unboundQueries(pg)[kind]();

      expect(() => query.getSql()).toThrow(UnboundParameterError);
      await expect(query.execute()).rejects.toThrow(UnboundParameterError);
    },
  );

  it('SHOULD pass casts, literals, comments, quoted names and slice bounds', () => {
    enableUnboundParameterGuard();

    const query = pg
      .createQueryBuilder()
      .select(`u.email::text || ':literal' || E'\\':escaped' || $$:dollar$$ || $tag$:tagged$tag$`, 'text')
      .addSelect('(ARRAY[u.id, u.id])[1:u.id]', 'slice')
      .addSelect('u.id AS ":quoted"')
      .from(UnboundGuardUserEntity, 'u')
      .where('u.email = :email', { email: 'a@b.c' })
      .andWhere('u.status <> \'paid\' /* :comment /* :nested */ */ -- :line\n')
      .comment(':comment');

    expect(query.getSql()).toContain(`':literal'`);
  });

  it.each<[DatabaseType, string, string[]]>([
    [
      'postgres',
      `SELECT $t$ :a $t$, /* /* :b */ :c */ tags[1:n], (x)[lo:hi], ARRAY[:first, :...rest] FROM t WHERE a = :v`,
      [':first', ':...rest', ':v'],
    ],
    ['mysql', 'SELECT "a :x", \'b \\\' :y\', `c:z` # :w\n FROM t WHERE a = :v', [':v']],
    ['mysql', 'SELECT /* /* :b */ :c */ x FROM t', [':c']],
    ['better-sqlite3', 'SELECT [a:b], "c:d", `e:f` FROM t WHERE a = :v', [':v']],
    ['mssql', "SELECT geography::Point(1, 2, 4326), N'x :y', [a:b] FROM t WHERE a = :v", [':v']],
    ['oracle', 'SELECT * FROM t WHERE a = :1 AND b = :v', [':v']],
  ])('SHOULD read %s SQL as the database does', (driver, sql, expected) => {
    expect(findUnboundParameters(sql, driver).map(({ name, spread }) => `:${spread ? '...' : ''}${name}`)).toEqual(
      expected,
    );
  });

  it('SHOULD report in warn mode and leave the query as it is', () => {
    const onViolation = jest.fn();

    enableUnboundParameterGuard({ mode: 'warn', onViolation });

    const [sql] = unboundQueries(pg).select().getQueryAndParameters();

    expect(sql).toContain('email = :login');
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation.mock.calls[0][0]).toBeInstanceOf(UnboundParameterError);
    expect(onViolation.mock.calls[0][0].sql).toBe(sql);
  });

  it('SHOULD warn on the console by default in warn mode', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      enableUnboundParameterGuard({ mode: 'warn' });
      unboundQueries(pg).select().getSql();

      expect(warn).toHaveBeenCalledWith(expect.any(UnboundParameterError));
    } finally {
      warn.mockRestore();
    }
  });

  it('SHOULD report every execution of the same SQL', () => {
    const onViolation = jest.fn();

    enableUnboundParameterGuard({ mode: 'warn', onViolation });

    const query = unboundQueries(pg).select();

    query.getSql();
    query.getSql();

    expect(onViolation).toHaveBeenCalledTimes(2);
  });

  it('SHOULD check nothing once disabled', () => {
    enableUnboundParameterGuard();
    disableUnboundParameterGuard();

    expect(unboundQueries(pg).select().getSql()).toMatch(/:login/);
  });

  it('SHOULD reject an unknown mode', () => {
    expect(() => enableUnboundParameterGuard({ mode: 'error' as never })).toThrow(TypeError);
  });
});

setupTest('unbound parameter guard', { entities }, (context) => {
  const seed = () =>
    context.dataSource
      .getRepository(UnboundGuardUserEntity)
      .save([
        new UnboundGuardUserEntity({ email: 'a@b.c', status: 'new' }),
        new UnboundGuardUserEntity({ email: 'd@e.f', status: 'paid' }),
      ]);

  it('SHOULD reject a query with a parameter without a value before it runs, which the database rejects', async () => {
    await seed();
    enableUnboundParameterGuard();

    const runner = context.dataSource.createQueryRunner();
    const query = jest.spyOn(runner, 'query');
    const users = () =>
      context.dataSource
        .getRepository(UnboundGuardUserEntity)
        .createQueryBuilder('u', runner)
        .where('u.email = :login');

    try {
      await expect(users().getMany()).rejects.toThrow(UnboundParameterError);
      expect(query).not.toHaveBeenCalled();

      disableUnboundParameterGuard();

      const rejection = await rejectionOf(users().getMany());

      expect(rejection).toBeInstanceOf(Error);
      expect(rejection).not.toBeInstanceOf(UnboundParameterError);
    } finally {
      await runner.release();
    }
  });

  it('SHOULD run the queries whose parameters all have values with the guard on', async () => {
    await seed();
    enableUnboundParameterGuard();

    const users = () => context.dataSource.getRepository(UnboundGuardUserEntity).createQueryBuilder('u');

    const found = await users()
      .whereTyped((u) => u.status, '=', 'new')
      .andWhereIsInTyped((u) => u.email, ['a@b.c', 'd@e.f'])
      .andWhere('u.id IN (:...ids)', { ids: [1, 2] })
      .andWhere("u.email <> ':literal'")
      .getMany();

    expect(found.map(({ email }) => email)).toEqual(['a@b.c']);

    await context.dataSource
      .createQueryBuilder()
      .update(UnboundGuardUserEntity)
      .set({ status: 'paid' })
      .where('email = :email', { email: 'a@b.c' })
      .execute();
    await users().softDelete().where('email = :email', { email: 'd@e.f' }).execute();

    const left = await context.dataSource.getRepository(UnboundGuardUserEntity).find({ order: { id: 'ASC' } });

    expect(left.map(({ email, status }) => [email, status])).toEqual([['a@b.c', 'paid']]);
  });
});
