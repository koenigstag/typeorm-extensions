import 'typeorm-extensions';
import {
  Column,
  DataSource,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  disableReservedQualifierGuard,
  enableReservedQualifierGuard,
  POSTGRES_RESERVED_KEY_WORDS,
  ReservedQualifierError,
  tableHelper,
} from 'typeorm-extensions';
import { nativeSql, setupTest } from '../test-utils';
import { postgresLikeDrivers } from '../constants/database';

@Entity({ name: 'guard_users' })
class GuardUserEntity {
  constructor(partial: Partial<GuardUserEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar', nullable: true })
  public featureFlags: string | null;

  @OneToMany(() => GuardOrderEntity, (order) => order.customer)
  public orders?: GuardOrderEntity[];
}

@Entity({ name: 'guard_orders' })
class GuardOrderEntity {
  constructor(partial: Partial<GuardOrderEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'integer' })
  public userId: number;

  @Column({ type: 'varchar' })
  public status: string;

  @DeleteDateColumn()
  public deletedAt?: Date | null;

  @ManyToOne(() => GuardUserEntity, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public customer?: GuardUserEntity;
}

type Aliases = { order: GuardOrderEntity; user: GuardUserEntity };

const entities = [GuardUserEntity, GuardOrderEntity];

/** The queries of typed methods and tableHelper, with the reserved words `order` and `user` as aliases. */
const typedQueries = (dataSource: DataSource) => {
  const driver = dataSource.options.type;
  const order = tableHelper<GuardOrderEntity>('order', { driver });
  const user = tableHelper<GuardUserEntity>('user', { driver });
  const orders = () => dataSource.getRepository(GuardOrderEntity).createQueryBuilder('order');

  return {
    select: () =>
      orders()
        .leftJoinAndSelectTyped((o) => o.customer, 'user')
        .typed<Aliases>()
        .whereTyped((q) => q.order.userId, '=', 1)
        .andWhereIsInTyped((q) => q.order.status, ['open', 'paid'])
        .andWhere(`COALESCE(${user.featureFlags}, '') <> :blocked`, { blocked: 'blocked' })
        .andWhere(order.isNotNull('userId'))
        .orderByTyped((q) => q.user.id, 'ASC')
        .addOrderByTyped((q) => q.order.id, 'DESC'),
    grouped: () =>
      orders()
        .innerJoin('order.customer', 'user')
        .typed<Aliases>()
        .selectTyped((q) => q.order.userId, 'userId')
        .addSelect(order.count('id'), 'orders')
        .groupByTyped((q) => q.order.userId)
        .havingTyped('COUNT', (q) => q.order.id, '>=', 1)
        .orderByTyped((q) => q.order.userId),
    update: () =>
      dataSource
        .createQueryBuilder()
        .update(GuardOrderEntity)
        .set({ status: 'paid' })
        .whereTyped((o) => o.userId, '=', 1),
    remove: () => dataSource.createQueryBuilder().delete().from(GuardOrderEntity).whereTyped((o) => o.userId, '=', 2),
  };
};

/** Raw SQL that names an alias by a bare reserved word, on every kind of builder. */
const bareQueries = (dataSource: DataSource) => {
  const userExists = 'EXISTS (SELECT 1 FROM "guard_users" "user" WHERE user.id = "userId")';

  return {
    select: () =>
      dataSource.getRepository(GuardOrderEntity).createQueryBuilder('order').where('order."userId" = :id', { id: 1 }),
    insert: () =>
      dataSource
        .createQueryBuilder()
        .insert()
        .into(GuardOrderEntity)
        .values({ userId: 1, status: () => `(SELECT order.status FROM "guard_orders" "order" LIMIT 1)` }),
    update: () => dataSource.createQueryBuilder().update(GuardOrderEntity).set({ status: 'paid' }).where(userExists),
    remove: () => dataSource.createQueryBuilder().delete().from(GuardOrderEntity).where(userExists),
    softDelete: () => dataSource.createQueryBuilder(GuardOrderEntity, 'order').softDelete().where(userExists),
    restore: () => dataSource.createQueryBuilder(GuardOrderEntity, 'order').restore().where(userExists),
  };
};

afterEach(() => disableReservedQualifierGuard());

// SQL generation only: the data sources are never connected, so a query that got past the guard fails to connect
describe('reserved qualifier guard on PostgreSQL and CockroachDB', () => {
  let pg: DataSource;

  beforeAll(async () => {
    pg = new DataSource({ type: 'postgres', entities });
    // metadata without a connection, as initialize() builds it
    await (pg as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  it('SHOULD throw from getSql() for a bare reserved alias, naming the word and the fix', () => {
    enableReservedQualifierGuard();

    const thrown = (() => {
      try {
        bareQueries(pg).select().getSql();
      } catch (error) {
        return error as ReservedQualifierError;
      }
    })();

    expect(thrown).toBeInstanceOf(ReservedQualifierError);
    expect(thrown?.qualifiers).toEqual([
      { word: 'order', index: expect.any(Number), snippet: expect.stringContaining('WHERE ( order."userId" = $1 )') },
    ]);
    expect(thrown?.sql).toMatch(/WHERE \( order\."userId" = \$1 \)/);
    expect(thrown?.message).toContain('"order" in ');
    expect(thrown?.message).toContain('Quote both halves, "order"."userId"');
    expect(thrown?.message).toContain('tableHelper');
  });

  it.each(['getMany', 'getOne', 'getRawMany', 'getRawOne', 'getCount', 'getManyAndCount', 'stream'] as const)(
    'SHOULD reject %s() with the guard error before the query runs',
    async (method) => {
      enableReservedQualifierGuard();

      await expect(bareQueries(pg).select()[method]()).rejects.toThrow(ReservedQualifierError);
    },
  );

  it.each(['insert', 'update', 'remove', 'softDelete', 'restore'] as const)(
    'SHOULD reject execute() of %s queries with the guard error',
    async (kind) => {
      enableReservedQualifierGuard();

      const query = bareQueries(pg)[kind]();

      expect(() => query.getSql()).toThrow(ReservedQualifierError);
      await expect(query.execute()).rejects.toThrow(ReservedQualifierError);
    },
  );

  it('SHOULD pass the same queries with the alias quoted', () => {
    enableReservedQualifierGuard();

    const orders = pg.getRepository(GuardOrderEntity);

    expect(orders.createQueryBuilder('order').where('"order"."userId" = :id', { id: 1 }).getSql()).toContain(
      'WHERE ( "order"."userId" = $1 )',
    );
    expect(
      pg
        .createQueryBuilder()
        .delete()
        .from(GuardOrderEntity)
        .where('EXISTS (SELECT 1 FROM "guard_users" "user" WHERE "user".id = "userId")')
        .getSql(),
    ).toContain('"user".id');
  });

  it('SHOULD pass the SQL of typed methods and tableHelper', () => {
    enableReservedQualifierGuard();

    for (const [name, query] of Object.entries(typedQueries(pg))) {
      expect([name, query().getSql()]).toEqual([name, expect.any(String)]);
    }
  });

  it('SHOULD report the words passed instead of the defaults', () => {
    // a table without an entity: TypeORM leaves the condition as written
    const query = () => pg.createQueryBuilder().select('*').from('accounts', 'left').where('left.id = 1');

    enableReservedQualifierGuard();
    expect(() => query().getSql()).not.toThrow();

    enableReservedQualifierGuard({ words: [...POSTGRES_RESERVED_KEY_WORDS, 'left'] });
    expect(() => query().getSql()).toThrow(ReservedQualifierError);
  });

  it('SHOULD skip words inside literals, comments and quoted identifiers', () => {
    enableReservedQualifierGuard();

    const query = pg
      .createQueryBuilder()
      .select(`'order.x' || $$user.id$$`, 'text')
      .from('guard_users', 'user')
      .where('"user"."featureFlags" <> :flags', { flags: 'order.x' })
      .comment('order.x');

    expect(query.getSql()).toContain(`'order.x'`);
  });

  it('SHOULD report in warn mode and leave the query as it is', () => {
    const onViolation = jest.fn();

    enableReservedQualifierGuard({ mode: 'warn', onViolation });

    const [sql] = bareQueries(pg).select().getQueryAndParameters();

    expect(sql).toMatch(/WHERE \( order\."userId" = \$1 \)/);
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation.mock.calls[0][0]).toBeInstanceOf(ReservedQualifierError);
    expect(onViolation.mock.calls[0][0].sql).toBe(sql);
  });

  it('SHOULD warn on the console by default in warn mode', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      enableReservedQualifierGuard({ mode: 'warn' });
      bareQueries(pg).select().getSql();

      expect(warn).toHaveBeenCalledWith(expect.any(ReservedQualifierError));
    } finally {
      warn.mockRestore();
    }
  });

  it('SHOULD report every execution of the same SQL', () => {
    const onViolation = jest.fn();

    enableReservedQualifierGuard({ mode: 'warn', onViolation });

    const query = bareQueries(pg).select();

    query.getSql();
    query.getSql();

    expect(onViolation).toHaveBeenCalledTimes(2);
  });

  it('SHOULD check nothing once disabled', () => {
    enableReservedQualifierGuard();
    disableReservedQualifierGuard();

    expect(bareQueries(pg).select().getSql()).toMatch(/order\."userId"/);
  });

  it('SHOULD check CockroachDB, without SYSTEM_USER, which it does not reserve', () => {
    enableReservedQualifierGuard();

    const cockroach = new DataSource({ type: 'cockroachdb', timeTravelQueries: false } as never);
    const from = (alias: string) =>
      cockroach.createQueryBuilder().select('*').from('accounts', alias).where(`${alias}.id = 1`);

    expect(() => from('order').getSql()).toThrow(ReservedQualifierError);
    expect(() => from('system_user').getSql()).not.toThrow();
    expect(() =>
      pg.createQueryBuilder().select('*').from('accounts', 'system_user').where('system_user.id = 1').getSql(),
    ).toThrow(ReservedQualifierError);
  });

  it.each([
    ['mysql', {}],
    ['better-sqlite3', { database: ':memory:' }],
  ] as const)('SHOULD leave %s queries unchecked', (type, options) => {
    enableReservedQualifierGuard();

    const query = new DataSource({ type, ...options } as never)
      .createQueryBuilder()
      .select('*')
      .from('guard_orders', 'order')
      .where('order.id = 1');

    expect(query.getSql()).toContain('order.id = 1');
  });

  it('SHOULD reject an unknown mode and a word that is no key word', () => {
    expect(() => enableReservedQualifierGuard({ mode: 'error' as never })).toThrow(TypeError);
    expect(() => enableReservedQualifierGuard({ words: ['order.'] })).toThrow(TypeError);
  });
});

setupTest('reserved qualifier guard', { entities }, (context) => {
  const itPostgres = (name: string, test: () => Promise<void>) =>
    (postgresLikeDrivers.includes(context.typeormOptions.type as never) ? it : it.skip)(name, test);
  const itElsewhere = (name: string, test: () => Promise<void>) =>
    (postgresLikeDrivers.includes(context.typeormOptions.type as never) ? it.skip : it)(name, test);

  const seed = async () => {
    await context.dataSource
      .getRepository(GuardUserEntity)
      .save([new GuardUserEntity({ featureFlags: null }), new GuardUserEntity({ featureFlags: 'beta' })]);
    await context.dataSource.getRepository(GuardOrderEntity).save([
      new GuardOrderEntity({ userId: 1, status: 'open' }),
      new GuardOrderEntity({ userId: 1, status: 'paid' }),
      new GuardOrderEntity({ userId: 2, status: 'open' }),
    ]);
  };

  itPostgres('SHOULD reject a bare reserved alias before the query runs, which the database rejects', async () => {
    await seed();
    enableReservedQualifierGuard();

    const runner = context.dataSource.createQueryRunner();
    const query = jest.spyOn(runner, 'query');
    const orders = () =>
      context.dataSource
        .getRepository(GuardOrderEntity)
        .createQueryBuilder('order', runner)
        .where('order."userId" = :id', { id: 1 });

    try {
      await expect(orders().getMany()).rejects.toThrow(ReservedQualifierError);
      expect(query).not.toHaveBeenCalled();

      disableReservedQualifierGuard();

      await expect(orders().getMany()).rejects.toThrow(/syntax error at or near "order"/);
    } finally {
      await runner.release();
    }
  });

  itPostgres('SHOULD run the query with the alias quoted', async () => {
    await seed();
    enableReservedQualifierGuard();

    const found = await context.dataSource
      .getRepository(GuardOrderEntity)
      .createQueryBuilder('order')
      .where('"order"."userId" = :id', { id: 1 })
      .getMany();

    expect(found.map(({ status }) => status)).toEqual(['open', 'paid']);
  });

  itPostgres('SHOULD run the query in warn mode after reporting it', async () => {
    await seed();

    const onViolation = jest.fn();

    enableReservedQualifierGuard({ mode: 'warn', words: ['o'], onViolation });

    const found = await context.dataSource
      .getRepository(GuardOrderEntity)
      .createQueryBuilder('o')
      .where('o."userId" = :id', { id: 2 })
      .getMany();

    expect(found.map(({ status }) => status)).toEqual(['open']);
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation.mock.calls[0][0].qualifiers).toEqual([expect.objectContaining({ word: 'o' })]);
  });

  it('SHOULD run the queries of typed methods and tableHelper with the guard on', async () => {
    await seed();
    enableReservedQualifierGuard();

    const queries = typedQueries(context.dataSource);

    expect((await queries.select().getMany()).map(({ status, customer }) => [status, customer?.id])).toEqual([
      ['paid', 1],
      ['open', 1],
    ]);
    // MySQL reads a BIGINT count as a string
    expect((await queries.grouped().getRawMany()).map(({ userId, orders }) => [userId, Number(orders)])).toEqual([
      [1, 2],
      [2, 1],
    ]);

    await queries.update().execute();
    await queries.remove().execute();

    const left = await context.dataSource.getRepository(GuardOrderEntity).find({ order: { id: 'ASC' } });

    expect(left.map(({ userId, status }) => [userId, status])).toEqual([
      [1, 'paid'],
      [1, 'paid'],
    ]);
  });

  itElsewhere('SHOULD leave the queries of other databases unchecked', async () => {
    await seed();
    enableReservedQualifierGuard();

    // `user` is no reserved word on SQLite and MySQL
    const found = await context.dataSource
      .getRepository(GuardUserEntity)
      .createQueryBuilder('user')
      .where(nativeSql('user."featureFlags" = :flags'), { flags: 'beta' })
      .getMany();

    expect(found.map(({ id }) => id)).toEqual([2]);
  });
});
