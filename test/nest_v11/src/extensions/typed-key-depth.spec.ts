import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-joins/typed-joins.extension';
import 'typeorm-extensions/extensions/typed/typed-select/typed-select.extension';
import { getKey } from 'typeorm-extensions/utils/proxy-key.utils';
import { setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

const tooDeep = /is 3 levels deep, but typed methods support only "column" or "alias\.column"/;

describe('typed key depth', () => {
  it('SHOULD allow column and relation.column paths', () => {
    expect(getKey<UserEntity>((u) => u.email)).toBe('email');
    expect(getKey<UserEntity>((u) => u.images.url)).toBe('images.url');
    expect(getKey<ImageEntity>((i) => i.user.email)).toBe('user.email');
  });

  it('SHOULD allow a relation at the second level as a whole (nested join path)', () => {
    expect(getKey<UserEntity>((u) => u.images.user)).toBe('images.user');
  });

  it('SHOULD allow alias-keyed types', () => {
    type Joins = { user: UserEntity; img: ImageEntity };

    expect(getKey<Joins>((j) => j.img.url)).toBe('img.url');
    expect(getKey<Joins>((j) => j.user.createdAt)).toBe('user.createdAt');
  });

  it('SHOULD reject a third level at compile time and at runtime', () => {
    // @ts-expect-error nested relation column: 3 levels
    expect(() => getKey<UserEntity>((u) => u.images.user.email)).toThrow(tooDeep);

    // @ts-expect-error nested JSON key: 3 levels
    expect(() => getKey<UserEntity>((u) => u.metadata.settings.theme)).toThrow(tooDeep);
  });

  it('SHOULD reject a third level in an array of keys', () => {
    expect(() =>
      // @ts-expect-error one of the keys is 3 levels deep
      getKey<UserEntity>((u) => [u.id, u.images.user.email]),
    ).toThrow(tooDeep);
  });

  it('SHOULD name the path in the error', () => {
    // untyped proxies (e.g. a query builder without an entity) are only checked at runtime
    expect(() => getKey<any>((u) => u.images.user.email)).toThrow(
      'Typed key "images.user.email" is 3 levels deep',
    );
  });
});

setupTest('typed key depth in query builders', undefined, (context) => {
  it('SHOULD throw instead of building a query with a truncated key', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user');

    // @ts-expect-error 3 levels
    expect(() => query.clone().whereTyped((u) => u.images.user.email, '=', 'a@b.c')).toThrow(tooDeep);
    // @ts-expect-error 3 levels
    expect(() => query.clone().selectTyped((u) => u.images.user.email)).toThrow(tooDeep);
    // @ts-expect-error 3 levels
    expect(() => query.clone().leftJoinTyped((u) => u.images.user.images, 'x')).toThrow(tooDeep);
  });

  it('SHOULD still build two-level keys', () => {
    const query = context.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .leftJoinTyped((u) => u.images, 'images')
      .leftJoinTyped((u) => u.images.user, 'imageUser')
      .whereTyped((u) => u.images.url, 'IS NOT NULL');

    expect(query.getQuery()).toContain('LEFT JOIN "users" "imageUser"');
    expect(query.getQuery()).toContain('WHERE "images"."url" IS NOT NULL');
  });
});
