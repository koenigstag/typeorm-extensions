import { Brackets, Equal, In, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import 'typeorm-extensions/extensions/where-expression.extension';
import { IsIn, Or } from 'typeorm-extensions/utils/find-operator.utils';
import { setupTest, createFakeUsers, nativeSql, sqlOf } from '../test-utils';
import { UserEntity } from '../models';

setupTest('whereExpression', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id');
  const ids = async (query: ReturnType<typeof users>) => (await query.getMany()).map((user) => user.id);

  // users 1–4: Alice, Bob, Carol, Dave; Bob and Dave have metadata
  const seed = async () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave'];

    await context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index],
          metadata: (index % 2 === 1 ? { score: index } : null) as never,
        }),
      })
    );
  };

  const lowerName = () => nativeSql('LOWER("user"."firstName")');
  const nextId = () => nativeSql('("user"."id" + 1)');

  it('SHOULD compare the expression, written as is, through a find operator', async () => {
    await seed();

    const query = users().whereExpression(lowerName(), Equal('bob'));

    expect(sqlOf(query)).toMatch(/WHERE LOWER\("user"\."firstName"\) = :op_\w+/);
    expect(Object.values(query.getParameters())).toEqual(['bob']);
    expect(await ids(query)).toEqual([2]);

    expect(await ids(users().whereExpression(lowerName(), IsIn(['alice', 'dave'])))).toEqual([1, 4]);
    expect(await ids(users().whereExpression(lowerName(), Not(In(['alice', 'dave']))))).toEqual([2, 3]);
    expect(await ids(users().whereExpression(nextId(), MoreThan(3)).andWhereExpression(nextId(), LessThan(5)))).toEqual([3]);
    expect(await ids(users().whereExpression(nativeSql('"user"."metadata"'), IsNull()))).toEqual([1, 3]);
  });

  it('SHOULD match any of the operators through Or', async () => {
    await seed();

    const query = users().whereExpression(nextId(), Or(Equal(2), MoreThan(4)));

    expect(sqlOf(query)).toMatch(/WHERE \(\("user"\."id" \+ 1\) = :op_\w+ OR \("user"\."id" \+ 1\) > :op_\w+\)/);
    expect(await ids(query)).toEqual([1, 4]);
    expect(await ids(users().whereExpression(nextId(), Not(Or(Equal(2), MoreThan(4)))))).toEqual([2, 3]);
  });

  it('SHOULD take an SQL condition with its value, as whereTyped does', async () => {
    await seed();

    const appended = users().whereExpression(nextId(), '>', 3);

    expect(sqlOf(appended)).toMatch(/WHERE \("user"\."id" \+ 1\) > :\w+ ORDER BY/);
    expect(await ids(appended)).toEqual([3, 4]);
    expect(await ids(users().whereExpression(lowerName(), '= :name', { name: 'carol' }))).toEqual([3]);
    expect(await ids(users().whereExpression(lowerName(), 'IN (:...names)', { names: ['bob', 'dave'] }))).toEqual([2, 4]);
    expect(await ids(users().whereExpression(nativeSql('"user"."metadata"'), 'IS NOT NULL'))).toEqual([2, 4]);
  });

  it('SHOULD add OR conditions, and work in Brackets', async () => {
    await seed();

    expect(await ids(users().whereExpression(lowerName(), Equal('alice')).orWhereExpression(lowerName(), Equal('carol')))).toEqual([1, 3]);

    const query = users()
      .whereExpression(nextId(), MoreThan(1))
      .andWhere(
        new Brackets((qb) => {
          qb.whereExpression(lowerName(), Equal('bob')).orWhereExpression(lowerName(), Equal('dave'));
        })
      );

    expect(await ids(query)).toEqual([2, 4]);
  });

  it('SHOULD write the condition on UPDATE', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .update()
      .set({ lastName: 'Updated' })
      .whereExpression(nativeSql('LOWER("firstName")'), Or(Equal('alice'), Equal('bob')));

    expect(sqlOf(query)).toMatch(/WHERE \(LOWER\("firstName"\) = :op_\w+ OR LOWER\("firstName"\) = :op_\w+\)$/);
    expect((await query.execute()).affected).toBe(2);
  });

  it('SHOULD refuse a missing expression or condition instead of leaving the condition out', () => {
    expect(() => users().whereExpression('', Equal(1))).toThrow(TypeError);
    expect(() => users().whereExpression(undefined as never, Equal(1))).toThrow(TypeError);
    expect(() => users().andWhereExpression(lowerName(), undefined as never)).toThrow(TypeError);
    expect(() => users().andWhereExpression(lowerName(), ' ')).toThrow(TypeError);
  });
});
