import 'typeorm-extensions/extensions/where-array.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-array.extension';
import { SelectQueryBuilder } from 'typeorm';
import { setupTest, sqlOf } from '../test-utils';
import { UserEntity } from '../models';
import { ArticleEntity } from '../models/postgres/article.entity';
import { postgresLikeDrivers } from '../constants/database';

const isPostgres = (type: string) => postgresLikeDrivers.includes(type as never);

// SQL generation does not depend on the database
setupTest('where-array.sql', undefined, (context) => {
  it('SHOULD build @>, <@ and && with the whole array as one parameter', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereArrayContains('user.tags', ['a', 'b'])
      .andWhereArrayContainedBy('user.tags', ['a', 'b', 'c'])
      .orWhereArrayOverlaps('user.tags', ['z']);

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."tags" @> :where_\w+ AND "user"\."tags" <@ :andWhere_\w+ OR "user"\."tags" && :orWhere_\w+/,
    );

    const [, parameters] = query.getQueryAndParameters();
    expect(parameters).toEqual([['a', 'b'], ['a', 'b', 'c'], ['z']]);
  });

  it('SHOULD cast the parameter to arrayType and reject anything but a type name', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereArrayContains('user.ids', [1], 'int[]');

    expect(sqlOf(query)).toMatch(/WHERE "user"\."ids" @> CAST\(:where_\w+ AS int\[\]\)/);

    expect(() =>
      query.clone().whereArrayOverlaps('user.ids', [1], 'int[]) OR (TRUE'),
    ).toThrow(/Invalid array type/);
  });

  it('SHOULD bind empty arrays as is', () => {
    const [query, parameters] = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereArrayOverlaps('user.tags', [])
      .getQueryAndParameters();

    expect(query).not.toMatch(/FALSE|TRUE/);
    expect(parameters).toEqual([[]]);
  });

  it('SHOULD throw WHEN values are not an array', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    expect(() =>
      query.whereArrayContains('user.tags', undefined as unknown as string[]),
    ).toThrow(/expects an array of values/);
  });

  it('SHOULD take the column from the typed callback', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereArrayContainsTyped((u) => u.firstName, ['a'], 'text[]')
      .andWhereArrayOverlapsTyped((u) => u.email, ['b']);

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."firstName" @> CAST\(:where\w+ AS text\[\]\) AND "user"\."email" && :andWhere\w+/,
    );
  });

  it('SHOULD use a bare column on UPDATE / DELETE', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .whereArrayContainedByTyped((u) => u.firstName, ['a']);

    expect(sqlOf(query)).toMatch(/^DELETE FROM "users" WHERE "firstName" <@ :where\w+$/);
  });

  it('SHOULD throw WHEN the typed callback selects several columns', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    expect(() =>
      query.whereArrayContainsTyped((u) => [u.firstName, u.email], ['a']),
    ).toThrow(/whereArrayContainsTyped expects the callback to select a single column, got 2/);
  });
});

// array columns and operators: PostgreSQL and compatible databases only
setupTest('where-array.postgres', { entities: [ArticleEntity] }, (context) => {
  if (!isPostgres(context.typeormOptions.type)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = () =>
    context.dataSource.getRepository(ArticleEntity).save([
      new ArticleEntity({ title: 'a', tags: ['orm', 'sql'], reviewerIds: [1, 2] }),
      new ArticleEntity({ title: 'b', tags: ['orm'], reviewerIds: [2] }),
      new ArticleEntity({ title: 'c', tags: ['js'], reviewerIds: null }),
      new ArticleEntity({ title: 'd', tags: [], reviewerIds: [] }),
    ]);

  const titles = (articles: ArticleEntity[]) => articles.map((article) => article.title);

  it('SHOULD match rows by @>, <@ and &&', async () => {
    await seed();
    const repository = context.dataSource.getRepository(ArticleEntity);

    const contains = await repository
      .createQueryBuilder('a')
      .whereArrayContainsTyped((a) => a.tags, ['orm', 'sql'])
      .getMany();
    expect(titles(contains)).toEqual(['a']);

    const containedBy = await repository
      .createQueryBuilder('a')
      .whereArrayContainedByTyped((a) => a.tags, ['orm', 'js'])
      .getMany();
    expect(titles(containedBy)).toEqual(['b', 'c', 'd']);

    const overlaps = await repository
      .createQueryBuilder('a')
      .whereArrayOverlaps('a.tags', ['sql', 'js'])
      .getMany();
    expect(titles(overlaps)).toEqual(['a', 'c']);
  });

  it('SHOULD use the database column name and the cast type', async () => {
    await seed();

    const result = await context.dataSource
      .getRepository(ArticleEntity)
      .createQueryBuilder('a')
      .whereArrayContainsTyped((a) => a.reviewerIds, [2], 'int[]')
      .andWhereArrayOverlapsTyped((a) => a.tags, ['orm'])
      .getMany();

    expect(titles(result)).toEqual(['a', 'b']);
  });

  it('SHOULD follow PostgreSQL semantics for empty arrays and NULL columns', async () => {
    await seed();
    const repository = context.dataSource.getRepository(ArticleEntity);

    // every array contains the empty array, a NULL column does not
    const containsEmpty = await repository
      .createQueryBuilder('a')
      .whereArrayContainsTyped((a) => a.reviewerIds, [])
      .getMany();
    expect(titles(containsEmpty)).toEqual(['a', 'b', 'd']);

    // nothing overlaps the empty array
    const overlapsEmpty = await repository
      .createQueryBuilder('a')
      .whereArrayOverlapsTyped((a) => a.tags, [])
      .getMany();
    expect(overlapsEmpty).toHaveLength(0);
  });

  it('SHOULD update and delete with a bare column', async () => {
    await seed();
    const repository = context.dataSource.getRepository(ArticleEntity);

    await repository
      .createQueryBuilder()
      .update()
      .set({ title: 'tagged' })
      .whereArrayContainsTyped((a) => a.reviewerIds, [2])
      .execute();

    await repository
      .createQueryBuilder()
      .delete()
      .whereArrayOverlapsTyped((a) => a.tags, ['js'])
      .execute();

    expect(titles(await repository.find())).toEqual(['tagged', 'tagged', 'd']);
  });

  it('SHOULD use a GIN index on the array column', async () => {
    await seed();
    await context.dataSource.query('CREATE INDEX articles_tags_gin ON articles USING GIN (tags)');

    const [sql, parameters] = context.dataSource
      .getRepository(ArticleEntity)
      .createQueryBuilder('a')
      .whereArrayContainsTyped((a) => a.tags, ['orm'])
      .getQueryAndParameters();

    const plan = await context.dataSource.transaction(async (manager) => {
      // the entity orders by id, so rule out the primary key index scan too: GIN is a bitmap scan
      await manager.query('SET LOCAL enable_seqscan = off');
      await manager.query('SET LOCAL enable_indexscan = off');
      return manager.query(`EXPLAIN (COSTS OFF) ${sql}`, parameters);
    });

    expect(JSON.stringify(plan)).toMatch(/Bitmap Index Scan on articles_tags_gin/);
  });
});

// an array inside a JSON column: jsonb operators, PostgreSQL only
setupTest('where-array.json.postgres', { entities: [ArticleEntity] }, (context) => {
  if (!isPostgres(context.typeormOptions.type)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = () =>
    context.dataSource.getRepository(ArticleEntity).save(
      [
        ['a', ['x', 'y']],
        ['b', ['x']],
        ['c', ['z']],
        ['d', null],
      ].map(
        ([title, flags]) =>
          new ArticleEntity({
            title: title as string,
            tags: [],
            meta: flags ? { status: 'live', flags: flags as string[] } : null,
            legacyMeta: flags ? { status: 'live', flags: flags as string[] } : null,
          }),
      ),
    );

  const titles = async (build: (query: SelectQueryBuilder<ArticleEntity>) => unknown) => {
    const query = context.dataSource.getRepository(ArticleEntity).createQueryBuilder('a').orderBy('a.id');
    build(query);

    return (await query.getMany()).map((article) => article.title);
  };

  it('SHOULD match by @>, <@ and ?| on a jsonb and a json column', async () => {
    await seed();

    expect(await titles((q) => q.whereArrayContainsTyped((a) => a.meta.flags, ['x']))).toEqual(['a', 'b']);
    expect(await titles((q) => q.whereArrayContainedByTyped((a) => a.meta.flags, ['x', 'y']))).toEqual(['a', 'b']);
    expect(await titles((q) => q.whereArrayOverlapsTyped((a) => a.meta.flags, ['y', 'z']))).toEqual(['a', 'c']);
    expect(await titles((q) => q.whereArrayContainsTyped((a) => a.legacyMeta.flags, ['x']))).toEqual(['a', 'b']);
  });

  it('SHOULD match arrays only, not a string or an object at the path', async () => {
    await seed();
    await context.dataSource.getRepository(ArticleEntity).save([
      new ArticleEntity({ title: 'e', tags: [], meta: { status: 'live', flags: 'x' as never } }),
      new ArticleEntity({ title: 'f', tags: [], meta: { status: 'live', flags: { x: 1 } as never } }),
    ]);

    // jsonb reads "x" <@ ["x", "y"] as true, and ?| looks at the keys of an object
    expect(await titles((q) => q.whereArrayContainedByTyped((a) => a.meta.flags, ['x', 'y']))).toEqual(['a', 'b']);
    expect(await titles((q) => q.whereArrayOverlapsTyped((a) => a.meta.flags, ['x']))).toEqual(['a', 'b']);
  });

  it('SHOULD reject an overlap with other values than strings, and arrayType', () => {
    const query = context.dataSource.getRepository(ArticleEntity).createQueryBuilder('a');

    expect(() => query.whereArrayOverlapsTyped((a) => a.meta.flags, [1] as never)).toThrow(/takes strings/);
    expect(() => query.whereArrayContainsTyped((a) => a.meta.flags, ['x'], 'text[]')).toThrow(/arrayType/);
  });
});
