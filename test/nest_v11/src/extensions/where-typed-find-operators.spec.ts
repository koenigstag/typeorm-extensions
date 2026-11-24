import * as typeorm from 'typeorm';
import { And, Any, Brackets, Equal, FindOperator, In, IsNull, LessThan, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/where-exists.extension';
import { EqualColumn, IsDistinctFrom, IsFalse, IsIn, IsTrue, Or } from 'typeorm-extensions/utils/find-operator.utils';
import 'typeorm-extensions/extensions/typed/typed-root.extension';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { mysqlLikeDrivers, postgresLikeDrivers } from '../constants/database';
import { TicketEntity, UserEntity } from '../models';

setupTest('whereTyped with TypeORM find operators', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');
  const ids = async (query: ReturnType<typeof users>) => (await query.getMany()).map((user) => user.id);

  // users 1–4: Alice, Bob, Carol, Dave; Carol's last name is her first name, Bob and Dave have metadata
  const seed = async () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave'];

    await context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index],
          ...(names[index] === 'Carol' ? { lastName: 'Carol' } : {}),
          metadata: (index % 2 === 1 ? { score: index } : null) as never,
        }),
      })
    );
  };

  it('SHOULD write the condition find() writes for the operator, with its value as a parameter', async () => {
    await seed();

    expect(await ids(users().whereTyped((u) => u.metadata, IsNull()))).toEqual([1, 3]);
    expect(await ids(users().whereTyped((u) => u.metadata, Not(IsNull())))).toEqual([2, 4]);
    expect(await ids(users().whereTyped((u) => u.firstName, Equal('Bob')))).toEqual([2]);
    expect(await ids(users().whereTyped((u) => u.firstName, In(['Alice', 'Dave'])))).toEqual([1, 4]);
    expect(await ids(users().whereTyped((u) => u.firstName, Not(In(['Alice', 'Dave']))))).toEqual([2, 3]);
    expect(await ids(users().whereTyped((u) => u.id, MoreThanOrEqual(2)).andWhereTyped((u) => u.id, LessThan(4)))).toEqual([2, 3]);
    expect(await ids(users().whereTyped((u) => u.firstName, In([])))).toEqual([]);

    const query = users().whereTyped((u) => u.firstName, Equal('Bob'));

    expect(sqlOf(query)).toMatch(/WHERE "user"\."firstName" = :op_\w+/);
    expect(Object.values(query.getParameters())).toEqual(['Bob']);
  });

  it('SHOULD match a list through IsIn and Not(IsIn), none or all rows for an empty one', async () => {
    await seed();

    expect(await ids(users().whereTyped((u) => u.firstName, IsIn(['Alice', 'Dave'])))).toEqual([1, 4]);
    expect(await ids(users().whereTyped((u) => u.firstName, Not(IsIn(['Alice', 'Dave']))))).toEqual([2, 3]);
    expect(await ids(users().whereTyped((u) => u.id, IsIn([] as number[])))).toEqual([]);
    expect(await ids(users().whereTyped((u) => u.id, Not(IsIn([] as number[]))))).toEqual([1, 2, 3, 4]);
  });

  it('SHOULD test a boolean with IsTrue / IsFalse, and match NULL too when negated, unlike Not(Equal())', async () => {
    type Flags = { f: { id: number; flag: boolean | null } };

    const flags = () =>
      context.dataSource
        .createQueryBuilder()
        .addCommonTableExpression('SELECT 1 AS id, TRUE AS flag UNION ALL SELECT 2, FALSE UNION ALL SELECT 3, NULL', 'f')
        .select(nativeSql('"f"."id"'), 'id')
        .from('f', 'f')
        .orderBy(nativeSql('"f"."id"'))
        .typed<Flags>();
    const flagIds = async (query: ReturnType<typeof flags>) =>
      (await query.getRawMany<{ id: number | string }>()).map((row) => Number(row.id));

    expect(await flagIds(flags().whereTyped((q) => q.f.flag, IsTrue()))).toEqual([1]);
    expect(await flagIds(flags().whereTyped((q) => q.f.flag, IsFalse()))).toEqual([2]);
    expect(await flagIds(flags().whereTyped((q) => q.f.flag, Not(IsTrue())))).toEqual([2, 3]);
    expect(await flagIds(flags().whereTyped((q) => q.f.flag, Not(IsFalse())))).toEqual([1, 3]);
    expect(await flagIds(flags().whereTyped((q) => q.f.flag, Not(Equal(true))))).toEqual([2]);
    expect(sqlOf(flags().whereTyped((q) => q.f.flag, Not(IsTrue())))).toMatch(/WHERE NOT\("f"\."flag" IS TRUE\)/);
  });

  it('SHOULD match any of the operators through Or, and none of them through Not(Or)', async () => {
    await seed();

    const either = users().whereTyped((u) => u.firstName, Or(Equal('Alice'), Equal('Dave')));

    expect(sqlOf(either)).toMatch(/WHERE \("user"\."firstName" = :op_\w+ OR "user"\."firstName" = :op_\w+\)/);
    expect(Object.values(either.getParameters())).toEqual(['Alice', 'Dave']);
    expect(await ids(either)).toEqual([1, 4]);

    const neither = users().whereTyped((u) => u.firstName, Not(Or(Equal('Alice'), Equal('Dave'))));

    expect(sqlOf(neither)).toMatch(/WHERE NOT\("user"\."firstName" = :op_\w+ OR "user"\."firstName" = :op_\w+\)/);
    expect(await ids(neither)).toEqual([2, 3]);

    expect(await ids(users().whereTyped((u) => u.id, Or(LessThan(2), MoreThan(3))))).toEqual([1, 4]);
    expect(await ids(users().whereTyped((u) => u.firstName, Or(Equal('Bob'), Or(Equal('Carol'), IsIn(['Dave'])))))).toEqual([2, 3, 4]);
    expect(await ids(users().whereTyped((u) => u.id, And(MoreThan(1), Or(LessThan(3), MoreThan(3)))))).toEqual([2, 4]);
    expect(await ids(users().whereTyped((u) => u.id, Or(Equal(3))))).toEqual([3]);
    expect(() => Or()).toThrow(TypeError);
  });

  it('SHOULD keep NULL rows with Or(IsNull(), …), which a plain comparison drops', async () => {
    type Ends = { e: { id: number; endedAt: number | null } };

    const ends = () =>
      context.dataSource
        .createQueryBuilder()
        .addCommonTableExpression('SELECT 1 AS id, 5 AS "endedAt" UNION ALL SELECT 2, 15 UNION ALL SELECT 3, NULL', 'e')
        .select(nativeSql('"e"."id"'), 'id')
        .from('e', 'e')
        .orderBy(nativeSql('"e"."id"'))
        .typed<Ends>();
    const endIds = async (query: ReturnType<typeof ends>) =>
      (await query.getRawMany<{ id: number | string }>()).map((row) => Number(row.id));

    expect(await endIds(ends().whereTyped((q) => q.e.endedAt, MoreThan(10)))).toEqual([2]);
    expect(await endIds(ends().whereTyped((q) => q.e.endedAt, Or(IsNull(), MoreThan(10))))).toEqual([2, 3]);
    expect(await endIds(ends().whereTyped((q) => q.e.endedAt, Not(Or(IsNull(), MoreThan(10)))))).toEqual([1]);
  });

  it("SHOULD write TypeORM's own Or the same way, where the TypeORM version has one", async () => {
    const nativeOr = (typeorm as unknown as { Or?: <T>(...values: FindOperator<T>[]) => FindOperator<T> }).Or;

    if (!nativeOr) {
      return;
    }

    await seed();

    const query = users().whereTyped((u) => u.firstName, nativeOr(Equal('Alice'), Equal('Dave')));

    expect(sqlOf(query)).toMatch(/WHERE \("user"\."firstName" = :op_\w+ OR "user"\."firstName" = :op_\w+\)/);
    expect(await ids(query)).toEqual([1, 4]);
  });

  it('SHOULD bind the list of Any as one array parameter', async () => {
    if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
      return;
    }

    await seed();

    const query = users()
      .whereTyped((u) => u.firstName, Any(['Alice', 'Dave']))
      .andWhereTyped((u) => u.id, Not(Any([4])));

    expect(sqlOf(query)).toMatch(/"user"\."firstName" = ANY\(:op_\w+\) AND NOT\("user"\."id" = ANY\(:op_\w+\)\)/);
    // TypeORM's Not() also sets an unused parameter with its operator's value: only the bound ones count
    expect(query.getQueryAndParameters()[1]).toEqual([['Alice', 'Dave'], [4]]);
    expect(await ids(query)).toEqual([1]);
    expect(await ids(users().whereTyped((u) => u.id, Any([] as number[])))).toEqual([]);
    expect(await ids(users().whereTyped((u) => u.id, Not(Any([] as number[]))))).toEqual([1, 2, 3, 4]);
  });

  it('SHOULD compare with NULL as with a value through IsDistinctFrom, and match NULL to NULL with Not', async () => {
    if (mysqlLikeDrivers.includes(context.typeormOptions.type as never)) {
      return;
    }

    type Notes = { n: { id: number; note: string | null } };

    const notes = () =>
      context.dataSource
        .createQueryBuilder()
        .addCommonTableExpression(`SELECT 1 AS id, 'a' AS note UNION ALL SELECT 2, 'b' UNION ALL SELECT 3, NULL`, 'n')
        .select(nativeSql('"n"."id"'), 'id')
        .from('n', 'n')
        .orderBy(nativeSql('"n"."id"'))
        .typed<Notes>();
    const noteIds = async (query: ReturnType<typeof notes>) =>
      (await query.getRawMany<{ id: number | string }>()).map((row) => Number(row.id));

    expect(await noteIds(notes().whereTyped((q) => q.n.note, IsDistinctFrom('a')))).toEqual([2, 3]);
    expect(await noteIds(notes().whereTyped((q) => q.n.note, Not(Equal('a'))))).toEqual([2]);
    expect(await noteIds(notes().whereTyped((q) => q.n.note, Not(IsDistinctFrom('a'))))).toEqual([1]);
    expect(await noteIds(notes().whereTyped((q) => q.n.note, Not(IsDistinctFrom(null))))).toEqual([3]);
    expect(await noteIds(notes().whereTyped((q) => q.n.note, IsDistinctFrom('a')).andWhereTyped((q) => q.n.note, IsDistinctFrom('b')))).toEqual([3]);
  });

  it('SHOULD compare with another column through EqualColumn, and negate it with Not', async () => {
    await seed();

    expect(await ids(users().whereTyped((u) => u.firstName, EqualColumn(nativeSql('"user"."lastName"'))))).toEqual([3]);
    expect(await ids(users().whereTyped((u) => u.firstName, Not(EqualColumn(nativeSql('"user"."lastName"')))))).toEqual([1, 2, 4]);
  });

  it('SHOULD keep the values of several operators apart, in Brackets and in an EXISTS subquery', async () => {
    await seed();
    await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
      new TicketEntity({ status: 'open', ownerId: 4 }),
    ]);

    const query = users()
      .whereTyped((u) => u.firstName, Not(Equal('Dave')))
      .andWhere(
        new Brackets((qb) => {
          qb.whereTyped<UserEntity>((u) => u.firstName, Equal('Alice')).orWhereTyped<UserEntity>((u) => u.firstName, Equal('Bob'));
        })
      )
      .andWhereExists(((sub: ReturnType<typeof users>) =>
        sub
          .select('1')
          .from(TicketEntity, 'ticket')
          .where(`ticket.ownerId = ${nativeSql('"user"."id"')}`)
          .andWhereTyped((t) => t.status, In(['open']))) as never);

    expect(await ids(query)).toEqual([1]);
  });

  it('SHOULD keep the values apart when a query takes the parameters of a subquery built on its own', async () => {
    await seed();
    await context.dataSource.getRepository(TicketEntity).save([
      new TicketEntity({ status: 'open', ownerId: 1 }),
      new TicketEntity({ status: 'done', ownerId: 2 }),
      new TicketEntity({ status: 'open', ownerId: 4 }),
    ]);

    // a separate builder numbers its parameters from orm_param_0 too
    const owners = context.dataSource
      .getRepository(TicketEntity)
      .createQueryBuilder('ticket')
      .select('ticket.ownerId')
      .whereTyped((t) => t.status, Equal('open'));
    const query = users()
      .whereTyped((u) => u.firstName, Not(Equal('Dave')))
      .andWhere(`${nativeSql('"user"."id"')} IN (${owners.getQuery()})`)
      .setParameters(owners.getParameters());

    expect(await ids(query)).toEqual([1]);
  });

  it('SHOULD write the operator on UPDATE without the alias', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update()
      .set({ lastName: 'Updated' })
      .whereTyped((u) => u.metadata, Not(IsNull()));

    expect(sqlOf(query)).toMatch(/WHERE NOT\("metadata" IS NULL\)$/);
    expect((await query.execute()).affected).toBe(2);
  });
});
