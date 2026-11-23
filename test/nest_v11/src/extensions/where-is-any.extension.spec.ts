import 'typeorm-extensions/extensions/where-is-any.extension';
import 'typeorm-extensions/extensions/where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-any.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import { setupTest, createFakeUsers, createFakeImages, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';
import { postgresLikeDrivers } from '../constants/database';

const STATUSES = ['active', 'trial'] as const;

// SQL generation does not depend on the database
setupTest('where-is-any.sql', undefined, (context) => {
  it('SHOULD build `column = ANY(:param)` with the whole array as one parameter', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAny('user.id', [1, 2, 3]);

    expect(sqlOf(query)).toMatch(/WHERE "user"\."id" = ANY\(:where_\w+\)/);

    const [, parameters] = query.getQueryAndParameters();
    expect(parameters).toEqual([[1, 2, 3]]);
  });

  it('SHOULD bind one parameter for any array size, unlike IN', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
    const repository = context.dataSource.getRepository(UserEntity);

    const [, anyParameters] = repository
      .createQueryBuilder('user')
      .whereIsAny('user.id', ids)
      .getQueryAndParameters();
    const [, inParameters] = repository
      .createQueryBuilder('user')
      .whereIsIn('user.id', ids)
      .getQueryAndParameters();

    expect(anyParameters).toHaveLength(1);
    expect(inParameters).toHaveLength(ids.length);
  });

  it('SHOULD combine with AND / OR', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAny('user.id', [1])
      .andWhereIsAny('user.email', ['a@b.c'])
      .orWhereIsAny('user.firstName', ['John']);

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."id" = ANY\(:where_\w+\) AND "user"\."email" = ANY\(:andWhere_\w+\) OR "user"\."firstName" = ANY\(:orWhere_\w+\)/,
    );
  });

  it('SHOULD use FALSE for an empty or missing array', () => {
    const repository = context.dataSource.getRepository(UserEntity);

    expect(
      repository.createQueryBuilder('user').whereIsAny('user.id', []).getQuery(),
    ).toMatch(/WHERE FALSE/);
    expect(
      repository.createQueryBuilder('user').whereIsAny('user.id').getQuery(),
    ).toMatch(/WHERE FALSE/);
  });

  it('SHOULD take the column from the typed callback, including relations', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinTyped((u) => u.images, 'images')
      .whereIsAnyTyped((u) => u.id, [1, 2])
      .andWhereIsAnyTyped((u) => u.images.url, ['a.png']);

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."id" = ANY\(:where\w+\) AND "images"\."url" = ANY\(:andWhere\w+\)/,
    );
  });

  it('SHOULD accept readonly arrays', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAnyTyped((u) => u.firstName, STATUSES);

    const [, parameters] = query.getQueryAndParameters();
    expect(parameters).toEqual([['active', 'trial']]);
  });

  it('SHOULD work on DeleteQueryBuilder', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder()
      .delete()
      .whereIsAny('id', [1, 2]);

    expect(sqlOf(query)).toMatch(
      /^DELETE FROM "users" WHERE "id" = ANY\(:where_\w+\)$/,
    );
  });

  it('SHOULD throw WHEN the typed callback selects several columns', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    expect(() =>
      query.whereIsAnyTyped((u) => [u.id, u.email], [1]),
    ).toThrow(/single column, got 2/);
  });
});

// `= ANY(array)` needs array parameters: PostgreSQL and compatible databases only
setupTest('where-is-any.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const names = ['Alice', 'Bob', 'Carol', 'Dave'];

    return usersRepository.save(
      await createFakeUsers({
        count: names.length,
        getOverrides: (index) => ({ firstName: names[index] }),
      }),
    );
  };

  it('SHOULD select rows whose column is in the array', async () => {
    const users = await seed();
    const ids = [users[0].id, users[2].id];

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAny('user.id', ids)
      .orderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.id)).toEqual(ids);
  });

  it('SHOULD combine typed conditions with AND / OR', async () => {
    const users = await seed();

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAnyTyped((u) => u.id, [users[0].id, users[1].id])
      .andWhereIsAnyTyped((u) => u.firstName, ['Bob'] as const)
      .orWhereIsAnyTyped((u) => u.firstName, ['Dave'])
      .orderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.firstName)).toEqual(['Bob', 'Dave']);
  });

  it('SHOULD return nothing for an empty array', async () => {
    await seed();

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAnyTyped((u) => u.id, [])
      .getMany();

    expect(result).toHaveLength(0);
  });

  it('SHOULD filter by a joined relation column', async () => {
    const users = await seed();
    const images = await context.dataSource.getRepository(ImageEntity).save(
      await createFakeImages({
        count: 2,
        getOverrides: (index) => ({ id: index + 1, userId: users[index].id }),
      }),
    );

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .innerJoinTyped((u) => u.images, 'images')
      .whereIsAnyTyped((u) => u.images.url, [images[1].url])
      .getMany();

    expect(result.map((user) => user.id)).toEqual([users[1].id]);
  });

  it('SHOULD handle more values than the 65535 bind parameter limit', async () => {
    const users = await seed();
    const ids = [
      ...Array.from({ length: 70_000 }, (_, i) => 1_000_000 + i),
      users[3].id,
    ];

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAnyTyped((u) => u.id, ids)
      .getMany();

    expect(result.map((user) => user.firstName)).toEqual(['Dave']);
  });

  it('SHOULD delete rows with whereIsAny', async () => {
    const users = await seed();
    const usersRepository = context.dataSource.getRepository(UserEntity);

    await usersRepository
      .createQueryBuilder()
      .delete()
      .whereIsAny('id', [users[0].id, users[1].id])
      .execute();

    const rest = await usersRepository.find({ order: { id: 'ASC' } });
    expect(rest.map((user) => user.firstName)).toEqual(['Carol', 'Dave']);
  });
});

setupTest('where-is-any.array-type-and-not-any.sql', undefined, (context) => {
  it('SHOULD cast the parameter to arrayType', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAny('user.id', [1, 2], 'int[]')
      .andWhereIsAnyTyped((u) => u.email, ['a@b.c'], 'character varying(255)[]');

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."id" = ANY\(CAST\(:where_\w+ AS int\[\]\)\) AND "user"\."email" = ANY\(CAST\(:andWhere_\w+ AS character varying\(255\)\[\]\)\)/,
    );
  });

  it('SHOULD reject an arrayType that is not a type name', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    for (const arrayType of ['int[]) OR (TRUE', "text'", 'int[]; DROP TABLE users']) {
      expect(() => query.clone().whereIsAny('user.id', [1], arrayType)).toThrow(
        /Invalid array type/,
      );
    }
  });

  it('SHOULD build `<> ALL(:param)` for whereIsNotAny', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsNotAny('user.id', [1, 2])
      .andWhereIsNotAnyTyped((u) => u.firstName, ['Bob'], 'text[]')
      .orWhereIsNotAny('user.email', []);

    expect(sqlOf(query)).toMatch(
      /WHERE "user"\."id" <> ALL\(:where_\w+\) AND "user"\."firstName" <> ALL\(CAST\(:andWhere_\w+ AS text\[\]\)\) OR TRUE/,
    );
  });
});

setupTest('where-is-any.array-type-and-not-any.postgres', undefined, (context) => {
  if (!postgresLikeDrivers.includes(context.typeormOptions.type as never)) {
    it.skip('only supported on postgres', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const seed = async () =>
    context.dataSource.getRepository(UserEntity).save(
      await createFakeUsers({
        count: 3,
        getOverrides: (index) => ({ firstName: ['Alice', 'Bob', 'Carol'][index] }),
      }),
    );

  it('SHOULD match with a cast parameter', async () => {
    const users = await seed();

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsAnyTyped((u) => u.id, [users[0].id, users[2].id], 'int[]')
      .andWhereIsAny('user.firstName', ['Alice', 'Carol'], 'text[]')
      .orderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.firstName)).toEqual(['Alice', 'Carol']);
  });

  it('SHOULD exclude every value with whereIsNotAny (<> ALL, not <> ANY)', async () => {
    await seed();
    const repository = context.dataSource.getRepository(UserEntity);

    const notAny = await repository
      .createQueryBuilder('user')
      .whereIsNotAnyTyped((u) => u.firstName, ['Alice', 'Bob'])
      .getMany();
    expect(notAny.map((user) => user.firstName)).toEqual(['Carol']);

    // what `<> ANY` would do: true unless the value equals every array element
    const wrong = await repository
      .createQueryBuilder('user')
      .where('"user"."firstName" <> ANY(:names)', { names: ['Alice', 'Bob'] })
      .getMany();
    expect(wrong).toHaveLength(3);
  });

  it('SHOULD keep every row for an empty whereIsNotAny array', async () => {
    await seed();

    const result = await context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .whereIsNotAny('user.firstName', [])
      .getMany();

    expect(result).toHaveLength(3);
  });

  it('SHOULD delete with whereIsNotAny', async () => {
    await seed();
    const repository = context.dataSource.getRepository(UserEntity);

    await repository
      .createQueryBuilder()
      .delete()
      .whereIsNotAnyTyped((u) => u.firstName, ['Bob'], 'text[]')
      .execute();

    expect((await repository.find()).map((user) => user.firstName)).toEqual(['Bob']);
  });
});
