// Ensure the extension is imported for side effects (module augmentation)
import 'typeorm-extensions/extensions/pagination.extension';
import { getLimitAndOffset } from 'typeorm-extensions/utils/pagination.utils';
import {
  setupTest,
  createFakeUsers,
  createFakeImages,
  createEmail,
} from '../test-utils';
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

      const page = 2;
      const pageSize = 3;
      const { limit, offset } = getLimitAndOffset({ page, pageSize });

      const paginatedQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...userIds)', { userIds: fakeUsers.map((u) => u.id) })
        .applyPaginationFilter({
          page,
          pageSize,
        });
      const usersQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...userIds)', { userIds: fakeUsers.map((u) => u.id) })
        .limit(limit)
        .offset(offset);

      expect(paginatedQuery.getQuery()).toContain(`LIMIT ${limit}`);
      expect(paginatedQuery.getQuery()).toContain(`OFFSET ${offset}`);
      expect(paginatedQuery.getQuery()).toEqual(usersQuery.getQuery());

      const result = await paginatedQuery.getMany();
      const users = await usersQuery.getMany();

      expect(result).toHaveLength(users.length);
      expect(offset).toBe((page - 1) * pageSize);
      expect(result[0]?.email).toBe(fakeUsers[offset]?.email);
    });

    it('SHOULD return total count correctly', async () => {
      const usersRepository = context.dataSource.getRepository(UserEntity);

      // seed 10 users
      const fakeUsers = await createFakeUsers({ count: 10 });
      await usersRepository.save(fakeUsers);

      const page = 1;
      const pageSize = 5;
      const { limit, offset } = getLimitAndOffset({
        page,
        pageSize,
      });

      const paginatedQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
        .applyPaginationFilter({
          page,
          pageSize,
        });
      const usersQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
        .limit(limit)
        .offset(offset);

      expect(paginatedQuery.getQuery()).toContain(`LIMIT ${limit}`);
      expect(paginatedQuery.getQuery()).not.toContain(`OFFSET ${offset}`);
      expect(paginatedQuery.getQuery()).toEqual(usersQuery.getQuery());

      const allUsersCount = await usersRepository
        .createQueryBuilder('user')
        .getCount();

      const [result, total] = await paginatedQuery.getManyAndCount();
      expect(result).toHaveLength(pageSize);
      expect(total).toBe(allUsersCount); // total count of users

      expect(result[0].email).toBe(fakeUsers[offset].email);
      expect(offset).toBe((page - 1) * pageSize);
      expect(result[4].email).toBe(fakeUsers[offset + 4].email);
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
            id: user.id + index + 1,
            userId: user.id,
          }),
        });
        await imagesRepository.save(images);
      }

      const page = 2;
      const pageSize = 3;
      const { limit, offset } = getLimitAndOffset({
        page,
        pageSize,
      });

      const paginatedQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
        .applyPaginationFilter({ page, pageSize }, { useTakeAndSkip: true });

      expect(paginatedQuery.getQuery()).toContain(`LIMIT ${limit}`);
      expect(paginatedQuery.getQuery()).toContain(`OFFSET ${offset}`);

      const result = await paginatedQuery.getMany();

      expect(result).toHaveLength(pageSize);
      expect(result[0].email).toBe(fakeUsers[offset].email); // page 2 and pageSize 3 => offset 3
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
            id: user.id + index + 1,
            userId: user.id,
          }),
        });
        await imagesRepository.save(images);
      }

      const page = 1;
      const pageSize = 5;
      const { limit, offset } = getLimitAndOffset({
        page,
        pageSize,
      });

      const paginatedQuery = usersRepository
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect('user.email')
        .where('user.id IN (:...ids)', { ids: fakeUsers.map((u) => u.id) })
        .applyPaginationFilter({ page, pageSize }, { useTakeAndSkip: true });

      expect(paginatedQuery.getQuery()).toContain(`LIMIT ${limit}`);
      expect(paginatedQuery.getQuery()).not.toContain(`OFFSET ${offset}`);

      const allUsersCount = await usersRepository
        .createQueryBuilder('user')
        .getCount();

      const [result, total] = await paginatedQuery.getManyAndCount();
      expect(result).toHaveLength(pageSize);
      expect(total).toBe(allUsersCount); // total count of users

      expect(result[0].email).toBe(fakeUsers[offset].email); // first user in the result
      expect(result[4].email).toBe(fakeUsers[offset + 4].email); // last user in the result
    });

    // TODO Add negative test cases
  },
);
