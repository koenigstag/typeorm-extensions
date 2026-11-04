import 'typeorm-extensions/extensions/where-json.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-json.extension';
import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { ArticleEntity } from '../models/postgres/article.entity';
import { postgresLikeDrivers } from '../constants/database';

const isPostgres = (type: string) => postgresLikeDrivers.includes(type as never);

// SQL generation does not depend on the database
setupTest('where-json.sql', undefined, (context) => {
  it('SHOULD build `@>` with the value as JSON text and `?` for keys', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereJsonContains('user.metadata', { role: 'admin' })
      .andWhereJsonHasKey('user.metadata', 'settings')
      .orWhereJsonContainsTyped((u) => u.metadata, ['a']);

    expect(query.getQuery()).toMatch(
      /WHERE CAST\("user"\."metadata" AS jsonb\) @> CAST\(:where_\w+ AS jsonb\) AND CAST\("user"\."metadata" AS jsonb\) \? :andWhere_\w+ OR CAST\("user"\."metadata" AS jsonb\) @> CAST\(:orWhere\w+ AS jsonb\)/,
    );

    const [, parameters] = query.getQueryAndParameters();
    expect(parameters).toEqual(['{"role":"admin"}', 'settings', '["a"]']);
  });

  it('SHOULD accept JSON expressions as the field', () => {
    const u = tableHelper<UserEntity>('user');

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereJsonHasKey(u.jsonColumn('metadata', '->', 'settings'), 'theme');

    expect(query.getQuery()).toMatch(
      /WHERE CAST\("user"\."metadata" -> 'settings' AS jsonb\) \? :where_\w+/,
    );
  });

  it('SHOULD throw for values without a JSON form and for non-string keys', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    expect(() => query.clone().whereJsonContains('user.metadata', undefined)).toThrow(
      /expects a JSON value/,
    );
    expect(() =>
      query.clone().whereJsonHasKey('user.metadata', 1 as unknown as string),
    ).toThrow(/expects a string key/);
  });

  it('SHOULD use a bare column on UPDATE / DELETE', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .whereJsonHasKeyTyped((u) => u.metadata, 'role');

    expect(query.getQuery()).toMatch(
      /^DELETE FROM "users" WHERE CAST\("metadata" AS jsonb\) \? :where\w+$/,
    );
  });
});

// jsonb operators: PostgreSQL and compatible databases only
setupTest('where-json.postgres', { entities: [ArticleEntity, UserEntity, ImageEntity] }, (context) => {
  if (!isPostgres(context.typeormOptions.type)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = () => {
    const metas = [
      { status: 'published', author: { name: 'Ann' }, flags: ['featured'] },
      { status: 'published', author: { name: 'Bob' } },
      { status: 'draft' },
      null,
    ];

    return context.dataSource.getRepository(ArticleEntity).save(
      metas.map(
        (meta, i) =>
          new ArticleEntity({ title: 'abcd'[i], meta, legacyMeta: meta }),
      ),
    );
  };

  const titles = (articles: ArticleEntity[]) => articles.map((article) => article.title);

  it('SHOULD match documents containing a partial object, nested values and array elements', async () => {
    await seed();
    const repository = context.dataSource.getRepository(ArticleEntity);

    const published = await repository
      .createQueryBuilder('a')
      .whereJsonContainsTyped((a) => a.meta, { status: 'published' })
      .getMany();
    expect(titles(published)).toEqual(['a', 'b']);

    const byAuthor = await repository
      .createQueryBuilder('a')
      .whereJsonContains('a.meta', { author: { name: 'Bob' } })
      .getMany();
    expect(titles(byAuthor)).toEqual(['b']);

    const featured = await repository
      .createQueryBuilder('a')
      .whereJsonContainsTyped((a) => a.meta, { flags: ['featured'] })
      .getMany();
    expect(titles(featured)).toEqual(['a']);
  });

  it('SHOULD match documents with a top-level key', async () => {
    await seed();

    const result = await context.dataSource
      .getRepository(ArticleEntity)
      .createQueryBuilder('a')
      .whereJsonHasKeyTyped((a) => a.meta, 'author')
      .getMany();

    expect(titles(result)).toEqual(['a', 'b']);
  });

  it('SHOULD work on `json` columns and with the database column name', async () => {
    await seed();

    const result = await context.dataSource
      .getRepository(ArticleEntity)
      .createQueryBuilder('a')
      .whereJsonContainsTyped((a) => a.legacyMeta, { status: 'published' })
      .andWhereJsonHasKeyTyped((a) => a.legacyMeta, 'flags')
      .getMany();

    expect(titles(result)).toEqual(['a']);
  });

  it('SHOULD work on `simple-json` (JSON text) columns', async () => {
    const users = context.dataSource.getRepository(UserEntity);
    await users.save([
      new UserEntity({ firstName: 'Ann', lastName: 'A', email: 'ann@mail.com', metadata: { role: 'admin', settings: { theme: 'dark', status: 'active' } } }),
      new UserEntity({ firstName: 'Bob', lastName: 'B', email: 'bob@mail.com', metadata: { role: 'user', settings: { theme: 'light', status: 'active' } } }),
    ]);

    const result = await users
      .createQueryBuilder('user')
      .whereJsonContainsTyped((u) => u.metadata, { settings: { theme: 'dark' } })
      .andWhereJsonHasKeyTyped((u) => u.metadata, 'role')
      .getMany();

    expect(result.map((user) => user.firstName)).toEqual(['Ann']);
  });

  it('SHOULD match keys of nested objects given a JSON expression', async () => {
    await seed();
    const a = tableHelper<ArticleEntity>('a');

    const result = await context.dataSource
      .getRepository(ArticleEntity)
      .createQueryBuilder('a')
      .whereJsonHasKey(a.jsonColumn('meta', '->', 'author'), 'name')
      .getMany();

    expect(titles(result)).toEqual(['a', 'b']);
  });

  it('SHOULD update and delete with a bare column', async () => {
    await seed();
    const repository = context.dataSource.getRepository(ArticleEntity);

    await repository
      .createQueryBuilder()
      .update()
      .set({ title: 'drafted' })
      .whereJsonContainsTyped((a) => a.meta, { status: 'draft' })
      .execute();

    await repository
      .createQueryBuilder()
      .delete()
      .whereJsonHasKeyTyped((a) => a.meta, 'flags')
      .execute();

    expect(titles(await repository.find())).toEqual(['b', 'drafted', 'd']);
  });

  it('SHOULD use a GIN index on a jsonb column despite the cast', async () => {
    await seed();
    await context.dataSource.query('CREATE INDEX articles_meta_gin ON articles USING GIN (meta)');

    const explain = async (sql: string, parameters: unknown[]) =>
      JSON.stringify(
        await context.dataSource.transaction(async (manager) => {
          // the entity orders by id, so rule out the primary key index scan too: GIN is a bitmap scan
          await manager.query('SET LOCAL enable_seqscan = off');
          await manager.query('SET LOCAL enable_indexscan = off');
          return manager.query(`EXPLAIN (COSTS OFF) ${sql}`, parameters);
        }),
      );

    const repository = context.dataSource.getRepository(ArticleEntity);

    expect(
      await explain(
        ...repository
          .createQueryBuilder('a')
          .whereJsonContainsTyped((a) => a.meta, { status: 'draft' })
          .getQueryAndParameters(),
      ),
    ).toMatch(/Bitmap Index Scan on articles_meta_gin/);

    expect(
      await explain(
        ...repository
          .createQueryBuilder('a')
          .whereJsonHasKeyTyped((a) => a.meta, 'author')
          .getQueryAndParameters(),
      ),
    ).toMatch(/Bitmap Index Scan on articles_meta_gin/);
  });
});
