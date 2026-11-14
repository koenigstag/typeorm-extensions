// Ensure the extension is imported for side effects (module augmentation)
import 'typeorm-extensions/extensions/pagination.extension';
import { getLimitAndOffset } from 'typeorm-extensions/utils/pagination.utils';
import {
  setupTest,
  createFakeUsers,
  createFakeImages,
  createEmail, sqlOf } from '../test-utils';
import { UserEntity, ImageEntity } from '../models';

setupTest(
  'pagination.applyPagination.limitAndOffset',
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
        .applyPagination({
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

      expect(sqlOf(paginatedQuery)).toContain(`LIMIT ${limit}`);
      expect(sqlOf(paginatedQuery)).toContain(`OFFSET ${offset}`);
      expect(sqlOf(paginatedQuery)).toEqual(sqlOf(usersQuery));

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
        .applyPagination({
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

      // the first page has no offset: recent TypeORM versions write `OFFSET 0`, older ones leave it out
      expect(sqlOf(paginatedQuery)).toMatch(new RegExp(`LIMIT ${limit}( OFFSET ${offset})?$`));
      expect(sqlOf(paginatedQuery)).toEqual(sqlOf(usersQuery));

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
  'pagination.applyPagination.takeAndSkip',
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
        .applyPagination({ page, pageSize }, { useTakeAndSkip: true });

      expect(sqlOf(paginatedQuery)).toContain(`LIMIT ${limit}`);
      expect(sqlOf(paginatedQuery)).toContain(`OFFSET ${offset}`);

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
        .applyPagination({ page, pageSize }, { useTakeAndSkip: true });

      // the first page has no offset: recent TypeORM versions write `OFFSET 0`, older ones leave it out
      expect(sqlOf(paginatedQuery)).toMatch(new RegExp(`LIMIT ${limit}( OFFSET ${offset})?$`));

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

setupTest(
  'pagination.applyPaginationFilter.legacyName',
  undefined,
  (context) => {
    it('SHOULD page the query exactly like applyPagination', () => {
      const query = () =>
        context.dataSource.getRepository(UserEntity).createQueryBuilder('user').select('user.id');

      expect(sqlOf(query().applyPaginationFilter({ page: 3, pageSize: 4 }))).toEqual(
        sqlOf(query().applyPagination({ page: 3, pageSize: 4 })),
      );
      expect(
        query().applyPaginationFilter({ page: 3, pageSize: 4 }, { useTakeAndSkip: true }).expressionMap.take,
      ).toBe(4);
    });
  },
);
