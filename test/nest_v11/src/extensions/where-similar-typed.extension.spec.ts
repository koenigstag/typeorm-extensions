import 'typeorm-extensions/extensions/typed/typed-where/typed-where-similar.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-ilike.extension';
import 'typeorm-extensions/extensions/typed/typed-order-by/typed-order-by-similarity.extension';
import { DataSource } from 'typeorm';
import { setupTest, createFakeUsers, sqlOf } from '../test-utils';
import { UserEntity } from '../models';
import { ArticleEntity } from '../models/postgres/article.entity';
import { postgresLikeDrivers } from '../constants/database';

// SQL generation only: the data sources are never connected
const builderOf = (type: 'postgres' | 'mysql' | 'better-sqlite3') =>
  new DataSource({ type, database: ':memory:' } as never).createQueryBuilder().select('u.id').from('users', 'u');

const pg = () => builderOf('postgres');

type Query = { getQuery(): string; getQueryAndParameters(): [string, unknown[]]; getParameters(): object };

const params = (query: Query) => query.getQueryAndParameters()[1];

// the values bound, once each: TypeORM 0.3.12 repeats a parameter used twice in getQueryAndParameters()
const values = (query: Query) => Object.values(query.getParameters());

// parameters numbered in order of appearance, `$1` each time one is repeated, as TypeORM 0.3.13+ writes them
const numbered = (sql: string) => {
  const names = new Map<string, string>();

  return sql.replace(/(?<!:):(\w+)/g, (_reference, name: string) => {
    if (!names.has(name)) {
      names.set(name, `$${names.size + 1}`);
    }

    return names.get(name) as string;
  });
};

// the entities order by id by default
const whereOf = (query: Query) =>
  numbered(query.getQuery())
    .replace(/^.* WHERE /, '')
    .replace(/ ORDER BY [^)]*$/, '');

describe('where-similar-typed.sql', () => {
  let withEntities: DataSource;

  beforeAll(async () => {
    // UserEntity's date columns take the type of the suite's database, so only ArticleEntity here
    withEntities = new DataSource({ type: 'postgres', entities: [ArticleEntity] });
    // metadata without a connection, as initialize() builds it
    await (withEntities as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  const articles = () => withEntities.getRepository(ArticleEntity).createQueryBuilder('article');

  it('SHOULD build `column % :term` by default, with the column on the left', () => {
    const query = pg().whereSimilarTyped<UserEntity>((u) => u.firstName, ' jon ');

    expect(query.getQuery()).toMatch(/WHERE "u"\."firstName" % :where_\w+$/);
    expect(params(query)).toEqual(['jon']);
  });

  it.each(['%>', '<%', '%>>', '<<%'] as const)('SHOULD build `column %s :term`', (operator) => {
    const query = pg()
      .where('u.id > 0')
      .andWhereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator });

    expect(sqlOf(query)).toContain(`AND "u"."firstName" ${operator} :andWhere_`);
  });

  it('SHOULD put a path into a JSON column in parentheses, where `%` would bind to the key', () => {
    expect(whereOf(articles().whereSimilarTyped((a) => a.meta.author.name, 'ann'))).toBe(
      `("article"."meta" -> 'author' ->> 'name') % $1`,
    );
    expect(whereOf(articles().whereSimilarTyped((a) => a.legacyMeta.status, 'draft'))).toBe(
      `("article"."legacy_meta" ->> 'status') % $1`,
    );
  });

  it('SHOULD add no condition for a blank term or one shorter than minLength', () => {
    expect(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, '  ').getQuery()).not.toContain('WHERE');
    expect(pg().orWhereSimilarTyped<UserEntity>((u) => u.firstName, null).getQuery()).not.toContain('WHERE');
    expect(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, ' jo ', { minLength: 3 }).getQuery()).not.toContain(
      'WHERE',
    );
    expect(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { minLength: 3 }).getQuery()).toContain('WHERE');
  });

  it('SHOULD throw for an invalid operator', () => {
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator: '<->' as never }),
    ).toThrow(/invalid operator "<->"/);
  });

  it.each([
    ['%', `("u"."firstName" % $1 AND similarity("u"."firstName", $1) >= $2)`],
    ['%>', `("u"."firstName" %> $1 AND word_similarity($1, "u"."firstName") >= $2)`],
    ['<%', `("u"."firstName" <% $1 AND word_similarity("u"."firstName", $1) >= $2)`],
    ['%>>', `("u"."firstName" %>> $1 AND strict_word_similarity($1, "u"."firstName") >= $2)`],
    ['<<%', `("u"."firstName" <<% $1 AND strict_word_similarity("u"."firstName", $1) >= $2)`],
  ] as const)('SHOULD pair %s with the score it compares for minScore', (operator, sql) => {
    const query = pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator, minScore: 0.5 });

    expect(whereOf(query)).toBe(sql);
    expect(values(query)).toEqual(['jon', 0.5]);
  });

  it.each([-0.1, 1.5, NaN, '0.5'])('SHOULD throw for minScore %p', (minScore) => {
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { minScore: minScore as number }),
    ).toThrow(/minScore must be/);
  });

  it('SHOULD compare the score alone with operator: false', () => {
    expect(whereOf(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator: false, minScore: 0.1 }))).toBe(
      'similarity("u"."firstName", $1) >= $2',
    );
    expect(
      whereOf(
        pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', {
          operator: false,
          minScore: 0.1,
          function: 'word_similarity',
        }),
      ),
    ).toBe('word_similarity($1, "u"."firstName") >= $2');
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { operator: false } as never),
    ).toThrow(/operator: false needs a minScore/);
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon', { function: 'word_similarity' } as never),
    ).toThrow(/options\.function needs operator: false/);
  });

  it('SHOULD wrap both sides with unaccent, in conditions and scores', () => {
    expect(whereOf(pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jose', { unaccent: true }))).toBe(
      'unaccent("u"."firstName") % unaccent($1)',
    );
    expect(
      sqlOf(pg().addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jose', 'score', { unaccent: 'immutable_unaccent' })),
    ).toMatch(/similarity\(immutable_unaccent\("u"\."firstName"\), immutable_unaccent\(:similarity_\w+\)\) AS "score"/);
    expect(() =>
      pg().whereSimilarTyped<UserEntity>((u) => u.firstName, 'jose', { unaccent: 'drop table' }),
    ).toThrow(/Invalid unaccent function/);
  });

  it.each(['mysql', 'better-sqlite3'] as const)('SHOULD throw on %s, where `%` is the modulo operator', (type) => {
    const error = new RegExp(`needs PostgreSQL with pg_trgm, not ${type}`);

    expect(() => builderOf(type).whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon')).toThrow(error);
    expect(() => builderOf(type).addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', 'score')).toThrow(error);
    expect(() => builderOf(type).orderBySimilarityTyped<UserEntity>((u) => u.firstName, 'jon')).toThrow(error);
    expect(() => builderOf(type).whereSearchTyped<UserEntity>((u) => u.firstName, 'jon', { similar: true })).toThrow(error);
    expect(sqlOf(builderOf(type).whereSearchTyped<UserEntity>((u) => u.firstName, 'jon'))).toContain(
      `"u"."firstName" LIKE :where_`,
    );
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

  it('SHOULD combine the scores of several columns, weighted, with a score for NULL', () => {
    const selectOf = (query: Query) =>
      numbered(query.getQuery()).replace(/^SELECT u\.id, (.*) FROM .*$/, '$1');

    expect(
      selectOf(pg().addSimilarityScoreTyped<UserEntity>((u) => [u.firstName, u.lastName], 'jon', 's', { combine: 'greatest' })),
    ).toBe('GREATEST(similarity("u"."firstName", $1), similarity("u"."lastName", $1)) AS "s"');
    expect(
      selectOf(
        pg().addSimilarityScoreTyped<UserEntity>(
          [{ column: (u) => u.firstName, weight: 2 }, { sql: `"u"."firstName" || ' ' || "u"."lastName"` }],
          'jon',
          's',
          { combine: 'sum', nullScore: 0 },
        ),
      ),
    ).toBe(
      `COALESCE(COALESCE(similarity("u"."firstName", $1) * 2, 0) + COALESCE(similarity(("u"."firstName" || ' ' || "u"."lastName"), $1), 0), 0) AS "s"`,
    );
    expect(() => pg().addSimilarityScoreTyped<UserEntity>((u) => [u.firstName, u.lastName], 'jon', 's')).toThrow(
      /selects 2 columns: set options\.combine/,
    );
  });

  it.each([NaN, Infinity, '2'])('SHOULD throw for the weight %p', (weight) => {
    expect(() =>
      pg().addSimilarityScoreTyped<UserEntity>([{ column: (u) => u.firstName, weight: weight as number }], 'jon', 's'),
    ).toThrow(/weight must be a finite number/);
  });

  it('SHOULD throw for an invalid score function or a missing alias', () => {
    expect(() =>
      pg().addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', 'score', { function: 'levenshtein' as never }),
    ).toThrow(/invalid function "levenshtein"/);
    expect(() => pg().addSimilarityScoreTyped<UserEntity>((u) => u.firstName, 'jon', '')).toThrow(
      /expects an alias for the score/,
    );
  });

  it('SHOULD add trigram conditions to the OR group of whereSearchTyped with similar', () => {
    const query = pg()
      .where('u.id > 0')
      .andWhereSearchTyped<UserEntity>((u) => [u.firstName, u.lastName], ' jon ', { similar: true });

    expect(whereOf(query)).toBe(
      'u.id > 0 AND ("u"."firstName" ILIKE $1 OR "u"."firstName" % $2 OR "u"."lastName" ILIKE $1 OR "u"."lastName" % $2)',
    );
    expect(values(query)).toEqual(['jon', '%jon%']);
  });

  it('SHOULD match only by trigrams with substring: false, and parenthesize expressions once', () => {
    const query = pg().whereSearchTyped<UserEntity>([{ sql: `"u"."firstName" || "u"."lastName"` }], 'jon', {
      similar: { operator: false, minScore: 0.2 },
      substring: false,
    });

    expect(whereOf(query)).toBe(`similarity(("u"."firstName" || "u"."lastName"), $1) >= $2`);
    expect(values(query)).toEqual(['jon', 0.2]);
    expect(() =>
      pg().whereSearchTyped<UserEntity>((u) => u.firstName, 'jon', { substring: false }),
    ).toThrow(/substring: false without similar leaves nothing to match/);
  });

  it('SHOULD put a JSON path in parentheses for the trigram operator only, and unaccent both conditions', () => {
    expect(
      whereOf(articles().whereSearchTyped((a) => a.meta.author.name, 'ann', { similar: { operator: '%>', minScore: 0.7 } })),
    ).toBe(
      `("article"."meta" -> 'author' ->> 'name' ILIKE $1 OR (("article"."meta" -> 'author' ->> 'name') %> $2 AND word_similarity($2, "article"."meta" -> 'author' ->> 'name') >= $3))`,
    );
    expect(whereOf(pg().whereSearchTyped<UserEntity>((u) => u.firstName, 'jose', { similar: true, unaccent: true }))).toBe(
      '(unaccent("u"."firstName") ILIKE unaccent($1) OR unaccent("u"."firstName") % unaccent($2))',
    );
  });

  it('SHOULD bind each call its own term', () => {
    const query = pg()
      .whereSimilarTyped<UserEntity>((u) => u.firstName, 'jon')
      .orWhereSimilarTyped<UserEntity>((u) => u.lastName, 'smith');

    expect(whereOf(query)).toBe('"u"."firstName" % $1 OR "u"."lastName" % $2');
    expect(values(query)).toEqual(['jon', 'smith']);
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
    ['Jonas', 'Smithsonian'],
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

  it('SHOULD match a word of the column with %>, and only whole words with %>>', async () => {
    await seed();

    // word_similarity('smith', 'Smithsonian') = 0.83, its strict word similarity 0.38, below the 0.5 threshold
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.lastName, 'smith', { operator: '%>' })),
    ).toEqual(['Jonathan', 'Jonas']);
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.lastName, 'smith', { operator: '%>>' })),
    ).toEqual(['Jonathan']);
  });

  it.each(['<%', '<<%'] as const)('SHOULD match a column that is a word of the term with %s', async (operator) => {
    await seed();

    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'mr bob the builder', { operator })),
    ).toEqual(['Bob']);
  });

  it('SHOULD keep only the rows that reach minScore', async () => {
    await seed();

    // similarity to 'Jonathan': Jonathan 1, Jonas 0.36; both pass the 0.3 session threshold of `%`
    expect(await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'Jonathan'))).toEqual(['Jonathan', 'Jonas']);
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'Jonathan', { minScore: 0.5 })),
    ).toEqual(['Jonathan']);
  });

  it('SHOULD match below the session threshold with operator: false, or with set_config inside a transaction', async () => {
    await seed();

    // similarity to 'Smithsonian Institute': Smithsonian 0.55, Smith 0.22
    const term = 'Smithsonian Institute';
    const percent = () => usersQuery().whereSimilarTyped((u) => u.lastName, term);

    expect(await firstNames(percent())).toEqual(['Jonas']);
    expect(
      await firstNames(usersQuery().whereSimilarTyped((u) => u.lastName, term, { operator: false, minScore: 0.1 })),
    ).toEqual(['Jonathan', 'Jonas']);

    const runner = context.dataSource.createQueryRunner();

    try {
      await runner.startTransaction();
      // `true`: SET LOCAL, for this transaction only
      await runner.query(`SELECT set_config('pg_trgm.similarity_threshold', '0.1', true)`);
      expect(await firstNames(percent().setQueryRunner(runner))).toEqual(['Jonathan', 'Jonas']);
      await runner.commitTransaction();

      // the same connection, after the transaction
      expect(await firstNames(percent().setQueryRunner(runner))).toEqual(['Jonas']);
    } finally {
      await runner.release();
    }
  });

  it('SHOULD match without accents with unaccent', async () => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    await context.dataSource
      .getRepository(UserEntity)
      .save(await createFakeUsers({ count: 1, getOverrides: () => ({ firstName: 'Éloïse', lastName: 'Martin' }) }));

    // similarity('Eloise', 'Éloïse') = 0.08
    expect(await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'Eloise'))).toEqual([]);
    expect(await firstNames(usersQuery().whereSimilarTyped((u) => u.firstName, 'Eloise', { unaccent: true }))).toEqual([
      'Éloïse',
    ]);
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

    it.each(['%', '%>', '%>>'] as const)('SHOULD use a gin_trgm_ops index for %s, also with minScore', async (operator) => {
      await createIndexes();

      for (const minScore of [undefined, 0.7]) {
        const [sql, parameters] = usersQuery()
          .whereSimilarTyped((u) => u.firstName, 'jonathan', { operator, minScore })
          .getQueryAndParameters();

        expect(await plan(sql, parameters)).toMatch(/Bitmap Index Scan on users_first_name_trgm/);
      }
    });

    it('SHOULD use no index for operator: false', async () => {
      await createIndexes();

      const [sql, parameters] = usersQuery()
        .whereSimilarTyped((u) => u.firstName, 'jonathan', { operator: false, minScore: 0.1 })
        .getQueryAndParameters();

      expect(await plan(sql, parameters)).not.toMatch(/users_first_name_trgm/);
    });

    it('SHOULD use gin_trgm_ops indexes for ILIKE and for every column of a search, with similar too', async () => {
      await createIndexes();

      const [ilikeSql, ilikeParameters] = usersQuery()
        .whereILikeTyped((u) => u.firstName, 'nat')
        .getQueryAndParameters();

      expect(await plan(ilikeSql, ilikeParameters)).toMatch(/Bitmap Index Scan on users_first_name_trgm/);

      for (const similar of [false, true]) {
        const [searchSql, searchParameters] = usersQuery()
          .whereSearchTyped([(u) => u.firstName, (u) => u.lastName], 'smith', { similar })
          .getQueryAndParameters();

        const searchPlan = await plan(searchSql, searchParameters);
        expect(searchPlan).toMatch(/BitmapOr/);
        expect(searchPlan).toMatch(/Bitmap Index Scan on users_first_name_trgm/);
        expect(searchPlan).toMatch(/Bitmap Index Scan on users_last_name_trgm/);
      }
    });
  });
});

setupTest('where-similar-typed.postgres.json', { entities: [ArticleEntity] }, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  it('SHOULD match a value inside a JSON column with % and with whereSearchTyped', async () => {
    await context.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    const repository = context.dataSource.getRepository(ArticleEntity);
    await repository.save([
      new ArticleEntity({ title: 'a', meta: { status: 'draft', author: { name: 'Annabel' } } }),
      new ArticleEntity({ title: 'b', meta: { status: 'draft', author: { name: 'Bob' } } }),
      new ArticleEntity({ title: 'c', meta: null }),
    ]);

    const titles = (query: { getMany(): Promise<ArticleEntity[]> }) =>
      query.getMany().then((rows) => rows.map((row) => row.title));
    const articles = () => repository.createQueryBuilder('article').orderBy('article.id', 'ASC');

    expect(await titles(articles().whereSimilarTyped((a) => a.meta.author.name, 'Anabel'))).toEqual(['a']);
    expect(
      await titles(articles().whereSearchTyped((a) => a.meta.author.name, 'Anabel', { similar: true, substring: false })),
    ).toEqual(['a']);
  });
});
