import 'typeorm-extensions';
import { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type {
  GetRawManyWithCursorOptions,
  ListWithCursor,
} from 'typeorm-extensions/types/extensions/cursor-pagination.types';
import type { SimilarityOrderOptions } from 'typeorm-extensions/types/extensions/search.types';
import { Sql } from 'typeorm-extensions/utils/sql-functions.utils';
import { setupTest, createFakeUsers, createFakeImages, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { ArticleEntity } from '../models/postgres/article.entity';
import { postgresLikeDrivers } from '../constants/database';

// SQL generation only: the data source is never connected
const pg = () => new DataSource({ type: 'postgres' }).createQueryBuilder().select('u.id').from('users', 'u');

describe('order-by-similarity-typed.sql', () => {
  it('SHOULD select the score under a generated lower-case alias and order by it, most similar first, NULLs last', () => {
    const [sql, parameters] = pg()
      .orderBy('1', 'ASC')
      .orderBySimilarityTyped<UserEntity>((u) => u.firstName, ' jon ')
      .getQueryAndParameters();

    const alias = /AS "(similarity_[a-z0-9]{5})"/.exec(sql)?.[1];
    expect(sql).toMatch(/^SELECT u\.id, similarity\("u"\."firstName", \$1\) AS "similarity_[a-z0-9]{5}" FROM/);
    expect(sql).toMatch(new RegExp(`ORDER BY ${alias} DESC NULLS LAST$`));
    expect(parameters).toEqual(['jon']);
  });

  it('SHOULD append to the ORDER BY with addOrderBySimilarityTyped, in the direction and nulls order given', () => {
    const query = pg()
      .orderBy('1', 'ASC')
      .addOrderBySimilarityTyped<UserEntity>((u) => u.firstName, 'jon', { alias: 'score', direction: 'ASC', nulls: 'first' });

    expect(sqlOf(query)).toMatch(/ORDER BY 1 ASC, score ASC NULLS FIRST$/);
  });

  it.each(['matchScore', 'order', 'a'.repeat(64), '1score', 'my-score'])('SHOULD throw for the alias %p', (alias) => {
    expect(() => pg().orderBySimilarityTyped<UserEntity>((u) => u.firstName, 'jon', { alias })).toThrow(/invalid alias/);
  });

  it('SHOULD order several columns by their combined score', () => {
    expect(
      sqlOf(
        pg().orderBySimilarityTyped<UserEntity>((u) => [u.firstName, u.lastName], 'jon', { alias: 'score', combine: 'greatest' }),
      ),
    ).toMatch(/GREATEST\(similarity\("u"\."firstName", :(\w+)\), similarity\("u"\."lastName", :\1\)\) AS "score".* ORDER BY score DESC NULLS LAST$/);
    expect(() => pg().orderBySimilarityTyped<UserEntity>((u) => [u.firstName, u.lastName], 'jon')).toThrow(
      /selects 2 columns/,
    );
  });

  it.each([
    ['similarity', '<->'],
    ['word_similarity', '<->>'],
    ['strict_word_similarity', '<->>>'],
  ] as const)('SHOULD order by the distance operator of %s, nearest first', (fn, operator) => {
    const [sql] = pg()
      .orderBySimilarityTyped<UserEntity>((u) => u.lastName, 'smith', { distance: true, function: fn, alias: 'dist' })
      .getQueryAndParameters();

    expect(sql).toMatch(new RegExp(`"u"\\."lastName" ${operator} \\$1 AS "dist" FROM .* ORDER BY dist ASC NULLS LAST$`));
  });

  it('SHOULD throw for distance on several columns, a weight or unaccent', () => {
    const error = /distance orders by one column, without a weight, unaccent or nullScore/;

    expect(() =>
      pg().orderBySimilarityTyped<UserEntity>((u) => [u.firstName, u.lastName], 'x', { distance: true, combine: 'greatest' }),
    ).toThrow(error);
    expect(() =>
      pg().orderBySimilarityTyped<UserEntity>([{ column: (u) => u.lastName, weight: 2 }], 'x', { distance: true }),
    ).toThrow(error);
    expect(() => pg().orderBySimilarityTyped<UserEntity>((u) => u.lastName, 'x', { distance: true, unaccent: true })).toThrow(
      error,
    );
  });

  it('SHOULD leave the selection and the ORDER BY as they are for a blank term, and still check the options', () => {
    const query = pg().orderBy('1', 'DESC');
    const sql = query.getQuery();

    expect(query.orderBySimilarityTyped<UserEntity>((u) => u.firstName, '  ').getQuery()).toBe(sql);
    expect(query.addOrderBySimilarityTyped<UserEntity>((u) => u.firstName, null).getQuery()).toBe(sql);
    expect(() => query.orderBySimilarityTyped<UserEntity>((u) => u.firstName, '', { alias: 'Score' })).toThrow(
      /invalid alias/,
    );
  });
});

// pg_trgm is a PostgreSQL extension
setupTest('order-by-similarity-typed.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const users = () => context.dataSource.getRepository(UserEntity);

  const seed = async (names: Array<[string, string]>, metadata?: (index: number) => UserEntity['metadata'] | null) => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    return users().save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({
          firstName: names[index][0],
          lastName: names[index][1],
          // the column is nullable, its type isn't
          ...(metadata ? { metadata: metadata(index) as UserEntity['metadata'] } : {}),
        }),
      }),
    );
  };

  const firstNames = (query: { getMany(): Promise<UserEntity[]> }) =>
    query.getMany().then((rows) => rows.map((row) => row.firstName));

  it('SHOULD order by the combined score: greatest and sum differ, and a weight counts', async () => {
    // similarity to 'smith': Smith 1, Zed 0; Smithy 0.63, Smithers 0.5
    await seed([
      ['Smith', 'Zed'],
      ['Smithy', 'Smithers'],
      ['Bob', 'Brown'],
    ]);

    const ordered = (options: SimilarityOrderOptions, weight?: number) =>
      firstNames(
        users()
          .createQueryBuilder('user')
          .orderBySimilarityTyped(
            [(u) => u.firstName, weight === undefined ? (u) => u.lastName : { column: (u) => u.lastName, weight }],
            'smith',
            options,
          )
          .addOrderByTyped((u) => u.id, 'ASC'),
      );

    expect(await ordered({ combine: 'greatest' })).toEqual(['Smith', 'Smithy', 'Bob']);
    expect(await ordered({ combine: 'sum' })).toEqual(['Smithy', 'Smith', 'Bob']);
    expect(await ordered({ combine: 'greatest' }, 3)).toEqual(['Smithy', 'Smith', 'Bob']);
  });

  it('SHOULD page with getManyWithTotals in score order, with take / skip and a joined collection, and with LIMIT', async () => {
    const saved = await seed([
      ['Jonathan', 'A'],
      ['Bob', 'B'],
      ['Jonas', 'C'],
      ['Jon', 'D'],
      ['Alice', 'E'],
    ]);
    await context.dataSource
      .getRepository(ImageEntity)
      .save(await createFakeImages({ count: 10, getOverrides: (i) => ({ id: i + 1, userId: saved[i % 5].id }) }));

    const expected = (
      await users()
        .createQueryBuilder('user')
        .addSimilarityScoreTyped((u) => u.firstName, 'jona', 'score')
        .orderBy('score', 'DESC')
        .addOrderBy('user.id', 'ASC')
        .getMany()
    ).map((user) => user.id);

    for (const join of [true, false]) {
      const pages: number[][] = [];

      for (const page of [1, 2, 3]) {
        const query = users().createQueryBuilder('user');
        const joined = join ? query.leftJoinAndSelect('user.images', 'image') : query;
        const result = await joined
          .orderBySimilarityTyped((u) => u.firstName, 'jona')
          .addOrderByTyped((u) => u.id, 'ASC')
          .getManyWithTotals({ page, pageSize: 2 }, { useTakeAndSkip: join });

        expect(result.total).toBe(5);
        pages.push(result.list.map((user) => user.id));

        if (join) {
          expect(result.list.every((user) => user.images?.length === 2)).toBe(true);
        }
      }

      expect(pages.flat()).toEqual(expected);
    }
  });

  describe('getRawManyWithCursor', () => {
    async function walk(
      query: () => SelectQueryBuilder<ObjectLiteral>,
      options: GetRawManyWithCursorOptions,
      pageSize: number,
    ): Promise<number[]> {
      const ids: number[] = [];
      let cursor: string | null = null;

      do {
        const page: ListWithCursor<{ id: number }> = await query().getRawManyWithCursor<{ id: number }>(
          { cursor, pageSize },
          options,
        );
        ids.push(...page.list.map((row) => Number(row.id)));
        cursor = page.nextCursor;
      } while (cursor && ids.length < 100);

      return ids;
    }

    const names: Array<[string, string]> = [
      ['Jonathan', 'Smith'],
      ['Jonas', 'Smithers'],
      ['Jon', 'Brown'],
      ['Bob', 'Jones'],
      ['Joan', 'Smith'],
      ['Alice', 'Cooper'],
      ['Jonas', 'Smithers'],
    ];

    const rows = () => users().createQueryBuilder('user').select('user.id', 'id');

    it('SHOULD page by a score through its select alias, with a new parameter name on every request', async () => {
      await seed(names);

      const scored = () =>
        rows().addSimilarityScoreTyped(
          [{ column: (u) => u.firstName, weight: 0.7 }, (u) => u.lastName],
          'jonas smith',
          'score',
          { combine: 'sum' },
        );
      const expected = (await scored().orderBy('score', 'DESC').addOrderBy('user.id', 'DESC').getRawMany()).map((row) =>
        Number(row.id),
      );

      // a weighted score is double precision: its value has to round-trip through the cursor exactly
      expect(await walk(scored, { orderBy: [{ alias: 'score', direction: 'DESC' }] }, 2)).toEqual(expected);
      expect(expected).toHaveLength(names.length);
    });

    it('SHOULD page by a score written with a parameter of a stable name', async () => {
      await seed(names);

      const score = Sql.coalesce(Sql.similarity('"user"."firstName"', ':q'), 0);
      const query = () => rows().setParameter('q', 'jona');
      const expected = (await query().orderBy(score, 'DESC').addOrderBy('user.id', 'DESC').getRawMany()).map((row) =>
        Number(row.id),
      );

      expect(await walk(query, { orderBy: [{ selector: score, direction: 'DESC' }] }, 3)).toEqual(expected);
    });

    it('SHOULD refuse a NULL score as a cursor key; nullScore gives it one', async () => {
      await seed(names, (index) => (index === 0 ? null : { role: 'admin', settings: { theme: 'dark', status: 'active' } }));

      const scored = (nullScore?: number) => () =>
        rows().addSimilarityScoreTyped((u) => u.metadata.role, 'admin', 'score', { nullScore });

      // DESC puts the NULL first, the last row of a one-row page
      await expect(walk(scored(), { orderBy: [{ alias: 'score', direction: 'DESC' }] }, 1)).rejects.toThrow(
        /is NULL in the last row; cursor keys must not be NULL/,
      );
      expect(await walk(scored(0), { orderBy: [{ alias: 'score', direction: 'DESC' }] }, 1)).toHaveLength(names.length);
    });
  });

  it('SHOULD order by distance through a GiST index scan, with LIMIT', async () => {
    await seed([
      ['A', 'Smith'],
      ['B', 'Smithers'],
      ['C', 'Brown'],
      ['D', 'Cooper'],
    ]);
    await context.dataSource.query('CREATE INDEX users_last_name_gist ON users USING GIST ("lastName" gist_trgm_ops)');

    const query = users()
      .createQueryBuilder('user')
      .orderBySimilarityTyped((u) => u.lastName, 'smith', { distance: true })
      .limit(2);

    expect((await query.getMany()).map((user) => user.lastName)).toEqual(['Smith', 'Smithers']);

    const [sql, parameters] = query.getQueryAndParameters();
    const plan = JSON.stringify(
      await context.dataSource.transaction(async (manager) => {
        await manager.query('SET LOCAL enable_seqscan = off');
        return manager.query(`EXPLAIN (COSTS OFF) ${sql}`, parameters);
      }),
    );

    expect(plan).toMatch(/Index Scan using users_last_name_gist on users/);
    expect(plan).toMatch(/Order By: \(\(\\"lastName\\"\)::text <-> /);
  });
});

setupTest('order-by-similarity-typed.postgres.json', { entities: [ArticleEntity] }, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD put rows without a value last, or first with nulls: first', async () => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    const repository = context.dataSource.getRepository(ArticleEntity);
    await repository.save([
      new ArticleEntity({ title: 'none', meta: null }),
      new ArticleEntity({ title: 'bob', meta: { status: 'draft', author: { name: 'Bob' } } }),
      new ArticleEntity({ title: 'annabel', meta: { status: 'draft', author: { name: 'Annabel' } } }),
    ]);

    const titles = (nulls?: 'first' | 'last') =>
      repository
        .createQueryBuilder('article')
        .orderBySimilarityTyped((a) => a.meta.author.name, 'anabel', { nulls })
        .getMany()
        .then((rows) => rows.map((row) => row.title));

    expect(await titles()).toEqual(['annabel', 'bob', 'none']);
    expect(await titles('first')).toEqual(['none', 'annabel', 'bob']);
  });
});
