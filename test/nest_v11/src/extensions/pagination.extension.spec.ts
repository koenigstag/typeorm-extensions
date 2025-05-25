// Ensure the extension is imported for side effects (module augmentation)
import { SelectQB } from '../../../../dist/extensions/pagination.extension';
import { faker } from '@faker-js/faker';
import { setupTest } from '../test-utils/setupTest';
import { UserEntity } from '../models/user.entity';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';

setupTest('pagination', {
  entities: [UserEntity],
  tests(repos) {
    it('applies limit and offset correctly', async () => {
      const usersRepository = repos.UserEntity;

      // seed 10 users
      for (let i = 0; i < 10; i++) {
        const user: UserEntity = new UserEntity();
        user.id = i + 1;
        user.email = `u${i + 1}@email.com`;
        user.firstName = faker.person.firstName();
        user.lastName = faker.person.lastName();

        await usersRepository.save(user);
      }

      const selectQuery = usersRepository.createQueryBuilder('user');

      console.log('Query class:', selectQuery instanceof SelectQB ? SelectQB.name : 'unknown');
      console.log('Has patch:', new SelectQB(selectQuery).applyPaginationFilter?.name || 'not patched');

      console.log('Is Same prototype:', SelectQueryBuilder.prototype === SelectQB.prototype);

      // @ts-expect-error: applyPaginationFilter is added via module augmentation
      const paginatedQuery = selectQuery.applyPaginationFilter({ page: 2, pageSize: 3 });

      const result = await paginatedQuery.getMany();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe('u4@email.com'); // page 2 and pageSize 3 => offset 3
    });
  },
});
