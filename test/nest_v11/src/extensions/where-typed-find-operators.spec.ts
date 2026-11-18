import { Brackets, Equal, In, IsNull, LessThan, MoreThanOrEqual, Not } from 'typeorm';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/where-exists.extension';
import { EqualColumn, IsIn } from 'typeorm-extensions/utils/find-operator.utils';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
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

    expect(sqlOf(query)).toMatch(/WHERE "user"\."firstName" = :orm_param_\d+/);
    expect(Object.values(query.getParameters())).toEqual(['Bob']);
  });

  it('SHOULD match a list through IsIn and Not(IsIn), none or all rows for an empty one', async () => {
    await seed();

    expect(await ids(users().whereTyped((u) => u.firstName, IsIn(['Alice', 'Dave'])))).toEqual([1, 4]);
    expect(await ids(users().whereTyped((u) => u.firstName, Not(IsIn(['Alice', 'Dave']))))).toEqual([2, 3]);
    expect(await ids(users().whereTyped((u) => u.id, IsIn([] as number[])))).toEqual([]);
    expect(await ids(users().whereTyped((u) => u.id, Not(IsIn([] as number[]))))).toEqual([1, 2, 3, 4]);
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
