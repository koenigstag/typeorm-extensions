// Ensure the extension is imported for side effects (module augmentation)
import 'typeorm-extensions/extensions/pagination.extension';
import { setupTest, createFakeUsers, createFakeImages, createEmail } from '../test-utils';
import { UserEntity, ImageEntity } from '../models';

setupTest(
  'pagination.applyPaginationFilter.limitAndOffset',
  undefined,
  (context) => {
    it('SHOULD apply limit and offset correctly', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      const selectQuery = usersRepository.createQueryBuilder('user');

      const paginatedQuery = selectQuery.applyPaginationFilter({
        page: 2,
        pageSize: 3,
      });

      expect(paginatedQuery.getQuery()).toContain('LIMIT 3');
      expect(paginatedQuery.getQuery()).toContain('OFFSET 3');

      const result = await paginatedQuery.getMany();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe(createEmail(3)); // page 2 and pageSize 3 => offset 3
    });

    it('SHOULD return total count currectly', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      const selectQuery = usersRepository.createQueryBuilder('user');

      const paginatedQuery = selectQuery.applyPaginationFilter({
        page: 1,
        pageSize: 5,
      });

      expect(paginatedQuery.getQuery()).toContain('LIMIT 5');
      expect(paginatedQuery.getQuery()).not.toContain('OFFSET 0');

      const [result, total] = await paginatedQuery.getManyAndCount();
      expect(result).toHaveLength(5);
      expect(total).toBe(10); // total count of users

      expect(result[0].email).toBe(createEmail(0)); // first user in the result
      expect(result[4].email).toBe(createEmail(4));
    });

    // TODO Add negative test cases
  },
);

setupTest(
  'pagination.applyPaginationFilter.takeAndSkip',
  undefined,
  (context) => {
    it('SHOULD apply limit and offset correctly using take and skip', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);
      const imagesRepository = context.dataSource.getRepository(ImageEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      // create 5 images for each user
      for (const user of fakeUsers) {
        const images = await createFakeImages({
          count: 5,
          getOverrides: (index) => ({
            id: index + 1,
            userId: user.id,
          }),
        });
        await imagesRepository.save(images);
      }

      const selectQuery = usersRepository.createQueryBuilder('user');

      const paginatedQuery = selectQuery.applyPaginationFilter(
        { page: 2, pageSize: 3 },
        { useTakeAndSkip: true },
      );

      expect(paginatedQuery.getQuery()).toContain('LIMIT 3');
      expect(paginatedQuery.getQuery()).toContain('OFFSET 3');

      const result = await paginatedQuery.getMany();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe(createEmail(3)); // page 2 and pageSize 3 => offset 3
    });

    it('SHOULD return total count currectly using take and skip', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);
      const imagesRepository = context.dataSource.getRepository(ImageEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      // create 5 images for each user
      for (const user of fakeUsers) {
        const images = await createFakeImages({
          count: 5,
          getOverrides: (index) => ({
            id: index + 1,
            userId: user.id,
          }),
        });
        await imagesRepository.save(images);
      }

      const selectQuery = usersRepository.createQueryBuilder('user');

      const paginatedQuery = selectQuery.applyPaginationFilter(
        { page: 1, pageSize: 5 },
        { useTakeAndSkip: true },
      );

      expect(paginatedQuery.getQuery()).toContain('LIMIT 5');
      expect(paginatedQuery.getQuery()).not.toContain('OFFSET 0');

      const [result, total] = await paginatedQuery.getManyAndCount();
      expect(result).toHaveLength(5);
      expect(total).toBe(10); // total count of users

      expect(result[0].email).toBe(createEmail(0)); // first user in the result
      expect(result[4].email).toBe(createEmail(4));
    });

    // TODO Add negative test cases
  },
);
