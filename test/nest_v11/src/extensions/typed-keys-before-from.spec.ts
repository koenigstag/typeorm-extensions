import 'typeorm-extensions/extensions/typed/typed-select/typed-select.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import 'typeorm-extensions/extensions/typed/typed-distinct/typed-distinct.extension';
import { KeyHolder } from 'typeorm-extensions/utils/proxy-key.utils';
import { setupTest, createFakeUsers, createFakeImages, nativeSql, sqlOf } from '../test-utils';
import { ImageEntity, TicketEntity, UserEntity } from '../models';

// alias-keyed types: the first key is the alias given to from()
type Base = { base: UserEntity };
type Img = { image: ImageEntity };

// A query created without an entity (`dataSource.createQueryBuilder()`, `qb.subQuery()`) has
// no main alias until from(). `alias.column` keys don't need it, so typed calls work before from().
setupTest('typed-keys.before-from', undefined, (context) => {
  const seed = async () => {
    const users = await context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: 3,
        getOverrides: (index) => ({ firstName: ['Alice', 'Bob', 'Carol'][index] }),
      }),
    );

    await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 2,
        getOverrides: (index) => ({
          id: index + 1,
          userId: [users[0].id, users[2].id][index],
          url: `${index + 1}.png`,
        }),
      }),
    );

    return users;
  };

  it('SHOULD select an alias.column key before from()', async () => {
    await seed();

    const query = context.dataSource
      .createQueryBuilder()
      .selectTyped<Base>((q) => q.base.firstName, 'name')
      .from(UserEntity, 'base')
      .orderBy('base.id', 'ASC');

    const rows = await query.getRawMany();
    expect(rows.map((row) => row.name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('SHOULD select several alias.column keys and KeyHolders before from()', async () => {
    await seed();

    const query = context.dataSource
      .createQueryBuilder()
      .selectTyped<Base>([(q) => q.base.id, (q) => q.base.firstName])
      .addSelectTyped([new KeyHolder(['base', 'email'])])
      .from(UserEntity, 'base');

    const sql = sqlOf(query);
    expect(sql).toContain('"base"."id" AS "base_id"');
    expect(sql).toContain('"base"."firstName" AS "base_firstName"');
    expect(sql).toContain('"base"."email" AS "base_email"');
  });

  it('SHOULD build a typed subquery with qb.subQuery()', async () => {
    const users = await seed();

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .selectTyped<Img>((q) => q.image.userId)
          .from(ImageEntity, 'image')
          .whereTyped<Img>((q) => q.image.url, 'LIKE', '%.png')
          .getQuery();

        return `${nativeSql('"user"."id"')} IN ${subQuery}`;
      })
      .orderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.id)).toEqual([users[0].id, users[2].id]);
  });

  it('SHOULD add typed where / order / distinct conditions before from()', () => {
    const query = context.dataSource
      .createQueryBuilder()
      .select('base.id')
      .whereTyped<Base>((q) => q.base.firstName, '=', 'Bob')
      .andWhereIsInTyped<Base>((q) => q.base.lastName, ['Doe'])
      .orderByTyped<Base>((q) => q.base.email, 'DESC')
      .addOrderByTyped<Base>((q) => q.base.id, 'ASC', undefined, { useQuotes: true })
      .from(UserEntity, 'base');

    expect(sqlOf(query)).toMatch(
      /WHERE "base"\."firstName" = :where_\w+ AND "base"\."lastName" IN \(:\.\.\.andWhere_\w+\) ORDER BY "base"\."email" DESC, "base"\."id" ASC$/,
    );
  });

  it('SHOULD map alias.column keys to column names once the alias is known', () => {
    // after from() the alias has metadata: `status` is the `ticket_status` column
    const query = context.dataSource
      .createQueryBuilder()
      .from(TicketEntity, 't')
      .selectTyped<{ t: TicketEntity }>((q) => q.t.status, undefined, true)
      .whereTyped<{ t: TicketEntity }>((q) => q.t.status, '=', 'open');

    expect(sqlOf(query)).toMatch(
      /^SELECT "t"\."ticket_status" FROM "tickets" "t" WHERE "t"\."ticket_status" = :where_\w+ ORDER BY "t"\."ticket_id" ASC$/,
    );
  });

  it('SHOULD explain a single-level key before from()', () => {
    const query = context.dataSource.createQueryBuilder();

    expect(() => query.selectTyped<UserEntity>((u) => u.firstName)).toThrow(
      /Typed key "firstName" has no alias and the query has no main alias yet\. Call from\(\) before this method/,
    );
    expect(() => query.whereTyped<UserEntity>((u) => u.firstName, '=', 'Bob')).toThrow(TypeError);
    expect(() => query.orderByTyped<UserEntity>((u) => u.id)).toThrow(TypeError);
  });

  it('SHOULD keep qualifying single-level keys with the main alias after from()', () => {
    const query = context.dataSource
      .createQueryBuilder()
      .from(UserEntity, 'u')
      .selectTyped<UserEntity>((u) => u.firstName)
      .whereTyped<UserEntity>((u) => u.lastName, '=', 'Doe');

    expect(sqlOf(query)).toMatch(
      /^SELECT "u"\."firstName" AS "u_firstName" FROM "users" "u" WHERE "u"\."lastName" = :where_\w+ ORDER BY "u"\."id" ASC$/,
    );
  });
});
