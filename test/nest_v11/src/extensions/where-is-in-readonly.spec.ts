import 'typeorm-extensions/extensions/where-is-in.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

// readonly tuple, like an `as const` constant in application code
const NAMES = ['Alice', 'Bob'] as const;

setupTest('where-is-in.readonly-arrays', undefined, (context) => {
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

  it('SHOULD accept readonly arrays in whereIsIn / whereIsNotIn', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const users = await seed();
    const ids: ReadonlyArray<number> = [users[0].id, users[2].id];

    const included = await usersRepository
      .createQueryBuilder('user')
      .whereIsIn('user.id', ids)
      .orderBy('user.id', 'ASC')
      .getMany();
    expect(included.map((user) => user.id)).toEqual(ids);

    const excluded = await usersRepository
      .createQueryBuilder('user')
      .whereIsNotIn('user.firstName', NAMES)
      .orderBy('user.id', 'ASC')
      .getMany();
    expect(excluded.map((user) => user.firstName)).toEqual(['Carol', 'Dave']);
  });

  it('SHOULD accept readonly arrays in typed IN / NOT IN methods', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    const users = await seed();
    const ids: ReadonlyArray<number> = [users[0].id, users[1].id, users[3].id];

    const result = await usersRepository
      .createQueryBuilder('user')
      .whereIsInTyped((u) => u.id, ids)
      .andWhereIsNotInTyped((u) => u.firstName, NAMES)
      .orWhereIsInTyped((u) => u.firstName, ['Carol'] as const)
      .orderBy('user.id', 'ASC')
      .getMany();

    expect(result.map((user) => user.firstName)).toEqual(['Carol', 'Dave']);
  });

  it('SHOULD accept readonly arrays on DeleteQueryBuilder', async () => {
    const usersRepository = context.dataSource.getRepository(UserEntity);
    await seed();

    await usersRepository
      .createQueryBuilder()
      .delete()
      .whereIsIn('firstName', NAMES)
      .execute();

    const rest = await usersRepository.find({ order: { id: 'ASC' } });
    expect(rest.map((user) => user.firstName)).toEqual(['Carol', 'Dave']);
  });
});
