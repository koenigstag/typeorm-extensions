// Ensure the extension is imported for side effects (module augmentation)
import 'typeorm-extensions/extensions/pagination.extension';
import { getLimitAndOffset, PageOutOfRangeError, setPaginationDefaults } from 'typeorm-extensions/utils/pagination.utils';
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

describe('pagination.getLimitAndOffset.defaultPageSize', () => {
  it('SHOULD read pages of the default page size given, and keep the page size of the filter', () => {
    expect(getLimitAndOffset({}, { defaultPageSize: 20 })).toEqual({ limit: 20, offset: 0, page: 1, pageSize: 20 });
    expect(getLimitAndOffset({ page: 3 }, { defaultPageSize: 20 })).toMatchObject({ limit: 20, offset: 40 });
    expect(getLimitAndOffset({ page: 3, pageSize: 5 }, { defaultPageSize: 20 })).toMatchObject({ limit: 5, offset: 10 });
    expect(getLimitAndOffset({ pageSize: '0' as never }, { defaultPageSize: 20 })).toMatchObject({ limit: 20 });
  });

  it('SHOULD fall back to 10 for a default page size below 1', () => {
    expect(getLimitAndOffset({ page: 2 }, { defaultPageSize: 0 })).toMatchObject({ limit: 10, offset: 10 });
  });
});

describe('pagination.getLimitAndOffset.maxPageSize', () => {
  it('SHOULD lower a larger page size to the max, and page by the lowered size', () => {
    expect(getLimitAndOffset({ page: 3, pageSize: 500 }, { maxPageSize: 100 })).toEqual({ limit: 100, offset: 200, page: 3, pageSize: 100 });
    expect(getLimitAndOffset({ pageSize: '1000' as never }, { maxPageSize: 100 })).toMatchObject({ limit: 100 });
    expect(getLimitAndOffset({ pageSize: 30 }, { maxPageSize: 100 })).toMatchObject({ limit: 30 });
  });

  it('SHOULD lower the default page size too', () => {
    expect(getLimitAndOffset({}, { defaultPageSize: 50, maxPageSize: 20 })).toMatchObject({ limit: 20 });
  });

  it('SHOULD ignore a max page size below 1', () => {
    expect(getLimitAndOffset({ pageSize: 500 }, { maxPageSize: 0 })).toMatchObject({ limit: 500 });
  });
});

setupTest(
  'pagination.applyPagination.pageSizeOptions',
  undefined,
  (context) => {
    it('SHOULD page by the default page size and cap at the max page size', () => {
      const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').select('user.id');

      expect(sqlOf(query().applyPagination({ page: 2 }, { defaultPageSize: 20 }))).toEqual(sqlOf(query().limit(20).offset(20)));
      expect(sqlOf(query().applyPagination({ page: 2, pageSize: 1000 }, { maxPageSize: 100 }))).toEqual(sqlOf(query().limit(100).offset(100)));
    });

    it('SHOULD page by offset and limit, and count pages from firstPage', () => {
      const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').select('user.id');

      expect(sqlOf(query().applyPagination({ offset: 5, limit: 3 }))).toEqual(sqlOf(query().limit(3).offset(5)));
      expect(sqlOf(query().applyPagination({ page: 1, pageSize: 4 }, { firstPage: 0 }))).toEqual(sqlOf(query().limit(4).offset(4)));
    });
  },
);

describe('pagination.getLimitAndOffset.offsetAndLimit', () => {
  it('SHOULD read the rows offset and limit name, under the same page size options', () => {
    expect(getLimitAndOffset({ offset: 5, limit: 10 })).toEqual({ limit: 10, offset: 5, page: 1, pageSize: 10 });
    expect(getLimitAndOffset({ offset: 40, limit: 20 })).toEqual({ limit: 20, offset: 40, page: 3, pageSize: 20 });
    expect(getLimitAndOffset({ offset: 0, limit: 500 }, { maxPageSize: 100 })).toMatchObject({ limit: 100 });
    expect(getLimitAndOffset({ offset: 30 }, { defaultPageSize: 25 })).toMatchObject({ limit: 25, offset: 30 });
    expect(getLimitAndOffset({ offset: -5, limit: '15' as never })).toMatchObject({ limit: 15, offset: 0 });
  });

  it('SHOULD read page and pageSize when the filter gives them as well', () => {
    expect(getLimitAndOffset({ page: 2, pageSize: 10, offset: 5, limit: 3 } as never)).toMatchObject({ limit: 10, offset: 10 });
  });
});

describe('pagination.getLimitAndOffset.input', () => {
  afterEach(() => setPaginationDefaults({}));

  // a request filter can carry fields its list doesn't declare
  const stray = { offset: 40, limit: 5000 } as never;

  it("SHOULD read only page and pageSize with input 'page', so a stray limit changes neither the page nor its size", () => {
    expect(getLimitAndOffset(stray, { input: 'page' })).toEqual({ limit: 10, offset: 0, page: 1, pageSize: 10 });
    expect(getLimitAndOffset({ page: 2, limit: 5000 } as never, { input: 'page', defaultPageSize: 20 })).toMatchObject({ limit: 20, offset: 20 });
  });

  it("SHOULD read only offset and limit with input 'offset'", () => {
    expect(getLimitAndOffset({ offset: 40, limit: 20, page: 9, pageSize: 3 } as never, { input: 'offset' })).toMatchObject({
      limit: 20,
      offset: 40,
      page: 3,
    });
    expect(getLimitAndOffset({ page: 9 } as never, { input: 'offset', defaultPageSize: 25 })).toMatchObject({ limit: 25, offset: 0 });
  });

  it('SHOULD take input from setPaginationDefaults, and let the call override it', () => {
    setPaginationDefaults({ input: 'page' });

    expect(getLimitAndOffset(stray)).toMatchObject({ limit: 10, offset: 0 });
    expect(getLimitAndOffset({ offset: 40, limit: 20 }, { input: 'offset' })).toMatchObject({ limit: 20, offset: 40 });
    expect(getLimitAndOffset(stray, { input: 'any' })).toMatchObject({ limit: 5000, offset: 40 });
  });
});

describe('pagination.getLimitAndOffset.firstPage', () => {
  afterEach(() => setPaginationDefaults({}));

  it('SHOULD count pages from 0 with firstPage 0', () => {
    expect(getLimitAndOffset({ page: 0, pageSize: 10 }, { firstPage: 0 })).toEqual({ limit: 10, offset: 0, page: 0, pageSize: 10 });
    expect(getLimitAndOffset({ page: 2, pageSize: 10 }, { firstPage: 0 })).toMatchObject({ offset: 20, page: 2 });
    expect(getLimitAndOffset({ page: -1 }, { firstPage: 0 })).toMatchObject({ offset: 0, page: 0 });
    expect(getLimitAndOffset({ offset: 20, limit: 10 }, { firstPage: 0 })).toMatchObject({ page: 2 });
  });

  it('SHOULD take the options the call leaves out from setPaginationDefaults', () => {
    setPaginationDefaults({ firstPage: 0, defaultPageSize: 20, maxPageSize: 50 });

    expect(getLimitAndOffset({ page: 1 })).toEqual({ limit: 20, offset: 20, page: 1, pageSize: 20 });
    expect(getLimitAndOffset({ pageSize: 100 })).toMatchObject({ limit: 50 });
    expect(getLimitAndOffset({ page: 1, pageSize: 10 }, { firstPage: 1 })).toMatchObject({ offset: 0, page: 1 });

    setPaginationDefaults({});

    expect(getLimitAndOffset({ page: 1 })).toEqual({ limit: 10, offset: 0, page: 1, pageSize: 10 });
  });
});

describe('pagination.getLimitAndOffset.maxPage', () => {
  afterEach(() => setPaginationDefaults({}));

  it('SHOULD read up to maxPage and throw a PageOutOfRangeError past it', () => {
    expect(getLimitAndOffset({ page: 3, pageSize: 10 }, { maxPage: 3 })).toMatchObject({ offset: 20 });
    expect(() => getLimitAndOffset({ page: 4, pageSize: 10 }, { maxPage: 3 })).toThrow(PageOutOfRangeError);
    expect(() => getLimitAndOffset({ offset: 30, limit: 10 }, { maxPage: 3 })).toThrow(RangeError);
    expect(getLimitAndOffset({ offset: 29, limit: 10 }, { maxPage: 3 })).toMatchObject({ offset: 29, page: 3 });
  });

  it('SHOULD count maxPage from firstPage, take it from setPaginationDefaults, and ignore one below the first page', () => {
    expect(() => getLimitAndOffset({ page: 3 }, { firstPage: 0, maxPage: 2 })).toThrow(PageOutOfRangeError);

    setPaginationDefaults({ maxPage: 2 });

    expect(() => getLimitAndOffset({ page: 3 })).toThrow(PageOutOfRangeError);
    expect(getLimitAndOffset({ page: 3 }, { maxPage: 0 })).toMatchObject({ page: 3 });
  });
});
