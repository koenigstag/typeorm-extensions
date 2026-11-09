import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-any.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-distinct-from.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-json.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by.extension';
import 'typeorm-extensions/extensions/typed/typed-select/typed-select.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { createFakeUser, setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { ArticleEntity } from '../models/postgres/article.entity';
import { postgresLikeDrivers } from '../constants/database';

const isPostgres = (type: string) => postgresLikeDrivers.includes(type as never);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tooDeep = /is 3 levels deep, but typed methods support only "column" or "alias\.column"/;

setupTest('typed JSON paths', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

  // `metadata` is `simple-json`: text, so PostgreSQL reads it as jsonb first
  const metadataSql = (column = '"user"."metadata"') =>
    isPostgres(context.typeormOptions.type) ? `CAST(${column} AS jsonb)` : column;

  it('SHOULD build a path into a JSON column at any depth', () => {
    const query = users()
      .whereTyped((u) => u.metadata.role, '=', 'admin')
      .andWhereTyped((u) => u.metadata.settings.theme, 'IS NOT NULL');

    expect(query.getQuery()).toMatch(
      new RegExp(
        escapeRegExp(`WHERE ${metadataSql()} ->> 'role' = :where`) +
          '\\w+' +
          escapeRegExp(` AND ${metadataSql()} -> 'settings' ->> 'theme' IS NOT NULL`),
      ),
    );
  });

  it('SHOULD find rows by the values inside the JSON column', async () => {
    const repository = context.dataSource.getRepository(UserEntity);
    const [darkAdmin, , lightAdmin] = await repository.save([
      createFakeUser({ metadata: { role: 'admin', settings: { theme: 'dark', status: 'active' } } }),
      createFakeUser({ metadata: { role: 'user', settings: { theme: 'dark', status: 'active' } } }),
      createFakeUser({ metadata: { role: 'admin', settings: { theme: 'light', status: 'inactive' } } }),
    ]);

    const admins = await users()
      .whereTyped((u) => u.metadata.role, '=', 'admin')
      .andWhereTyped((u) => u.metadata.settings.theme, '=', { theme: 'dark' })
      .getMany();

    const light = await users()
      .whereIsInTyped((u) => u.metadata.settings.theme, ['light'])
      .getMany();

    expect(admins.map((user) => user.id)).toEqual([darkAdmin.id]);
    expect(light.map((user) => user.id)).toEqual([lightAdmin.id]);
  });

  it('SHOULD address a JSON column of a joined entity by its alias', () => {
    const query = context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder('image')
      .leftJoinTyped((i) => i.user, 'owner')
      .whereTyped<{ owner: UserEntity }>((q) => q.owner.metadata.settings.theme, '=', 'dark');

    expect(query.getQuery()).toContain(
      `WHERE ${metadataSql('"owner"."metadata"')} -> 'settings' ->> 'theme' = :where`,
    );
  });

  it('SHOULD use the bare column on UPDATE / DELETE', () => {
    const update = context.dataSource
      .createQueryBuilder()
      .update(UserEntity)
      .set({ firstName: 'x' })
      .whereTyped((u) => u.metadata.settings.status, '=', 'inactive');

    const remove = context.dataSource
      .createQueryBuilder()
      .delete()
      .from(UserEntity)
      .whereTyped((u) => u.metadata.role, 'IS NULL');

    expect(update.getQuery()).toContain(`WHERE ${metadataSql('"metadata"')} -> 'settings' ->> 'status' = :where`);
    expect(remove.getQuery()).toContain(`WHERE ${metadataSql('"metadata"')} ->> 'role' IS NULL`);
  });

  it('SHOULD quote JSON keys as string literals', () => {
    const query = users().whereTyped<any>((u) => u.metadata["o'brien"], '=', 'yes');

    expect(query.getQuery()).toContain(`${metadataSql()} ->> 'o''brien' =`);
  });

  it('SHOULD keep rejecting deep paths that are not inside a JSON column', () => {
    const images = () => context.dataSource.getRepository(ImageEntity).createQueryBuilder('image');

    // @ts-expect-error a relation of a relation: 3 levels
    expect(() => images().whereTyped((i) => i.user.images.url, '=', 'x')).toThrow(tooDeep);
    // a column that isn't JSON has nothing inside it
    expect(() => users().whereTyped<any>((u) => u.email.domain.name, '=', 'x')).toThrow(tooDeep);
  });

  it('SHOULD reject a JSON path in select and order, which take columns', () => {
    const intoJson = /Typed key "metadata\.role" points into the JSON column "metadata"/;

    expect(() => users().orderByTyped((u) => u.metadata.role)).toThrow(intoJson);
    expect(() => users().selectTyped((u) => u.metadata.role)).toThrow(intoJson);
  });
});

setupTest('typed JSON paths on postgres', { entities: [ArticleEntity] }, (context) => {
  if (!isPostgres(context.typeormOptions.type)) {
    it.skip('only runs on postgres (jsonb, casts)', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const articles = () => context.dataSource.getRepository(ArticleEntity).createQueryBuilder('article');

  const seed = () =>
    context.dataSource.getRepository(ArticleEntity).save([
      new ArticleEntity({ title: 'nine', meta: { status: 'draft', score: 9, published: true, author: { name: 'Ann' } } }),
      new ArticleEntity({ title: 'ten', meta: { status: 'done', score: 10, published: false, author: { name: 'Bob' } } }),
    ]);

  const titles = (rows: ArticleEntity[]) => rows.map((article) => article.title);

  it('SHOULD compare numbers as numbers, not as text', async () => {
    await seed();

    const query = articles().whereTyped((a) => a.meta.score, '>=', { minScore: 10 });

    // as text '9' >= '10'
    expect(query.getQuery()).toContain(`WHERE CAST("article"."meta" ->> 'score' AS numeric) >= :where`);
    expect(titles(await query.getMany())).toEqual(['ten']);
  });

  it('SHOULD cast booleans and the values of IN and ANY', async () => {
    await seed();

    const published = await articles().whereTyped((a) => a.meta.published, '=', true).getMany();
    const inNine = await articles().whereIsInTyped((a) => a.meta.score, [9]).getMany();
    const anyTen = await articles().whereIsAnyTyped((a) => a.meta.score, [10]).getMany();
    const notNine = await articles().whereIsDistinctFromTyped((a) => a.meta.score, 9).getMany();

    expect(titles(published)).toEqual(['nine']);
    expect(titles(inNine)).toEqual(['nine']);
    expect(titles(anyTen)).toEqual(['ten']);
    expect(titles(notNine)).toEqual(['ten']);
  });

  it('SHOULD read nested keys of a jsonb column and keep text as text', async () => {
    await seed();

    const query = articles().whereTyped((a) => a.meta.author.name, '=', 'Bob');

    expect(query.getQuery()).toContain(`WHERE "article"."meta" -> 'author' ->> 'name' = :where`);
    expect(titles(await query.getMany())).toEqual(['ten']);
  });

  it('SHOULD use the json value (->) for JSON operators', async () => {
    await seed();

    const query = articles().whereJsonContainsTyped((a) => a.meta.author, { name: 'Ann' });

    expect(query.getQuery()).toContain(`WHERE CAST("article"."meta" -> 'author' AS jsonb) @> `);
    expect(titles(await query.getMany())).toEqual(['nine']);
  });

  it('SHOULD use the database name of a json column', async () => {
    await context.dataSource.getRepository(ArticleEntity).save([
      new ArticleEntity({ title: 'legacy', legacyMeta: { status: 'archived' } }),
      new ArticleEntity({ title: 'other', legacyMeta: { status: 'draft' } }),
    ]);

    const query = articles().whereTyped((a) => a.legacyMeta.status, '=', 'archived');

    expect(query.getQuery()).toContain(`WHERE "article"."legacy_meta" ->> 'status' = :where`);
    expect(titles(await query.getMany())).toEqual(['legacy']);
  });
});
