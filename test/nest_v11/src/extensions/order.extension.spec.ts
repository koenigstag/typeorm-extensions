import 'typeorm-extensions/extensions/order.extension';
import { setupTest, createFakeUsers } from '../test-utils';
import { UserEntity } from '../models';

setupTest(
  'order.applyOrderFilter',
  undefined,
  (context) => {
    it('SHOULD order by id DESC', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      const selectQuery = usersRepository.createQueryBuilder('user');

      const orderedQuery = selectQuery.applyOrderFilter({
        orderBy: [
          {
            field: 'id',
            direction: 'DESC',
          },
          {
            field: 'firstName',
            direction: 'ASC',
          },
          {
            field: 'lastName',
            direction: 'DESC',
          },
        ],
      });

      expect(orderedQuery.getQuery()).toContain('ORDER BY "user"."id" DESC');

      const result = await orderedQuery.getMany();

      expect(result).toHaveLength(10);
      expect(result[0].id).toBe(9); // last inserted user should be first in DESC order
    });

    // TODO Add negative test cases
  },
);

setupTest(
  'order.applyOrder',
  undefined,
  (context) => {
    it('SHOULD order by id DESC', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      const selectQuery = usersRepository.createQueryBuilder('user');

      const orderedQuery = selectQuery
        .applyOrder({
          field: 'id',
          direction: 'DESC',
        })
        .applyOrder({
          field: 'firstName',
          direction: 'ASC',
        })
        .applyOrder({
          field: 'lastName',
          direction: 'DESC',
        });

      expect(orderedQuery.getQuery()).toContain('ORDER BY "user"."id" DESC');

      const result = await orderedQuery.getMany();

      expect(result).toHaveLength(10);
      expect(result[0].id).toBe(9); // last inserted user should be first in DESC order
    });

    // TODO Add negative test cases
  },
);
