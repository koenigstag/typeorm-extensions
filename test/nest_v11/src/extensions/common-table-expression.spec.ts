import 'typeorm-extensions/extensions/common-table-expression.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

setupTest('common-table-expression', undefined, (context) => {
  it('SHOULD bind the parameters of a builder CTE in the DISTINCT query of take with a join', async () => {
    const users = context.dataSource.getRepository(UserEntity);
    const ids = (await users.save(await createFakeUsers({ count: 3 }))).slice(0, 2).map(({ id }) => id);
    const picked = users.createQueryBuilder('u').select('u.id', 'id').where('u.id IN (:...pickedIds)', { pickedIds: ids });

    const found = await users
      .createQueryBuilder('user')
      .addCommonTableExpression(picked, 'picked')
      .innerJoin('picked', 'picked', 'picked.id = user.id')
      .leftJoinAndSelect('user.images', 'image')
      .orderBy('user.id')
      .take(5)
      .getMany();

    expect(found.map(({ id }) => id)).toEqual([...ids].sort((a, b) => a - b));
  });
});
