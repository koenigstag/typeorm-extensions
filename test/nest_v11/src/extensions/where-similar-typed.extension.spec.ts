import 'typeorm-extensions/extensions/typed/typed-where/typed-where-similar.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-ilike.extension';
import { DataSource } from 'typeorm';
import { setupTest, createFakeUsers, sqlOf } from '../test-utils';
import { UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

// SQL generation only: the data source is never connected
const pg = () =>
  new DataSource({ type: 'postgres' }).createQueryBuilder().select('u.id').from('users', 'u');

const params = (query: { getQueryAndParameters(): [string, unknown[]] }) =>
  query.getQueryAndParameters()[1];

describe('where-similar-typed.sql', () => {
  it('SHOULD build `column % :term` by default, with the column on the left', () => {
    const query = pg().whereSimilarTyped<UserEntity>((u) => u.firstName, ' jon ');

    expect(query.getQuery()).toMatch(/WHERE "u"\."firstName" % :where_\w+$/);
    expect(params(query)).toEqual(['jon']);
  });

  it.each(['%>', '<%'] as const)('SHOULD build `column %s :term`', (operator) => {
    const query = pg()
      .where('u.id > 0')
      .andWhereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator });

    expect(sqlOf(query)).toContain(`AND "u"."firstName" ${operator} :andWhere_`);
  });

  it('SHOULD add no condition for a blank term', () => {
    expect(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, '  ').getQuery()).not.toContain('WHERE');
    expect(pg().orWhereSimilarTyped<UserEntity>((u) => u.firstName, null).getQuery()).not.toContain('WHERE');
  });

  it('SHOULD throw for an invalid operator', () => {
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator: '<->' as never }),
    ).toThrow(/invalid operator "<->"/);
  });

  it('SHOULD select a similarity score under the alias', () => {
    const query = pg()
      .addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', 'score')
      .addSimilarityScoreTyped<UserEntity>((u) => u.lastName, 'jon', 'word_score', {
        function: 'word_similarity',
      });

    expect(sqlOf(query)).toMatch(
      /^SELECT u\.id, similarity\("u"\."firstName", :similarity_\w+\) AS "score", word_similarity\(:similarity_\w+, "u"\."lastName"\) AS "word_score" FROM/,
    );
    expect(params(query)).toEqual(['jon', 'jon']);
  });

  it('SHOULD throw for an invalid score function or a missing alias', () => {
    expect(() =>
      pg().addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', 'score', { function: 'levenshtein' as never }),
    ).toThrow(/invalid function "levenshtein"/);
    expect(() => pg().addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', '')).toThrow(
      /expects an alias for the score/,
    );
  });
});

// pg_trgm is a PostgreSQL extension
setupTest('where-similar-typed.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const names = [
    ['Jonathan', 'Smith'],
    ['Bob', 'Brown'],
    ['Alice', 'Cooper'],
    ['Jonas', 'Smithson'],
  ];

  const seed = async () => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    return context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({ firstName: names[index][0], lastName: names[index][1] }),
      }),
    );
  };

  const usersQuery = () =>
    context.dataSource.getRepository(UserEntity).createQueryBuilder('user').orderBy('user.id', 'ASC');

  const firstNames = (query: { getMany(): Promise<UserEntity[]> }) =>
    query.getMany().then((users) => users.map((user) => user.firstName));

  it('SHOULD match similar values with %', async () => {
    await seed();

    // similarity('Cooper', 'Coper') = 0.625, above the default 0.3 threshold
    expect(await firstNames(usersQuery().whereSimilarTyped((u) => u.lastName, 'Coper'))).toEqual(['Alice']);
  });

  it('SHOULD match a word of the column with %>', async () => {
    await seed();

    // `"user"."lastName" %> 'smith'`: 'smith' is a word of the column
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.lastName, 'smith', { operator: '%>' })),
    ).toEqual(['Jonathan', 'Jonas']);
  });

  it('SHOULD match a column that is a word of the term with <%', async () => {
    await seed();

    // `"user"."firstName" <% 'mr bob the builder'`: the column is a word of the term
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'mr bob the builder', { operator: '<%' })),
    ).toEqual(['Bob']);
  });

  it('SHOULD order by the similarity score', async () => {
    await seed();

    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addSimilarityScoreTyped((u) => u.firstName, 'jona', 'score')
      .orderBy('score', 'DESC')
      .addOrderBy('user.id', 'ASC');

    const raw = await query.getRawMany();
    expect(raw.map((row) => row.user_firstName)).toEqual(['Jonas', 'Jonathan', 'Bob', 'Alice']);
    expect(raw[0].score).toBeGreaterThan(raw[1].score);
    expect(raw[3].score).toBe(0);

    expect(await firstNames(query.take(2))).toEqual(['Jonas', 'Jonathan']);
  });

  describe('trigram index', () => {
    const plan = async (sql: string, parameters: unknown[]) =>
      JSON.stringify(
        await context.dataSource.transaction(async (manager) => {
          // the entity orders by id, so rule out the primary key index scan too: GIN is a bitmap scan
          await manager.query('SET LOCAL enable_seqscan = off');
          await manager.query('SET LOCAL enable_indexscan = off');
          return manager.query(`EXPLAIN (COSTS OFF) ${sql}`, parameters);
        }),
      );

    const createIndexes = async () => {
      await seed();
      await context.dataSource.query(
        'CREATE INDEX users_first_name_trgm ON users USING GIN ("firstName" gin_trgm_ops)',
      );
      await context.dataSource.query(
        'CREATE INDEX users_last_name_trgm ON users USING GIN ("lastName" gin_trgm_ops)',
      );
    };

    it.each(['%', '%>'] as const)('SHOULD use a gin_trgm_ops index for %s', async (operator) => {
      await createIndexes();

      const [sql, parameters] = usersQuery()
        .whereSimilarTyped((u) => u.firstName, 'jonathan', { operator })
        .getQueryAndParameters();

      expect(await plan(sql, parameters)).toMatch(/Bitmap Index Scan on users_first_name_trgm/);
    });

    it('SHOULD use gin_trgm_ops indexes for ILIKE and for every column of a search', async () => {
      await createIndexes();

      const [ilikeSql, ilikeParameters] = usersQuery()
        .whereILikeTyped((u) => u.firstName, 'nat')
        .getQueryAndParameters();

      expect(await plan(ilikeSql, ilikeParameters)).toMatch(/Bitmap Index Scan on users_first_name_trgm/);

      const [searchSql, searchParameters] = usersQuery()
        .whereSearchTyped([(u) => u.firstName, (u) => u.lastName], 'smith')
        .getQueryAndParameters();

      const searchPlan = await plan(searchSql, searchParameters);
      expect(searchPlan).toMatch(/BitmapOr/);
      expect(searchPlan).toMatch(/Bitmap Index Scan on users_first_name_trgm/);
      expect(searchPlan).toMatch(/Bitmap Index Scan on users_last_name_trgm/);
    });
  });
});
