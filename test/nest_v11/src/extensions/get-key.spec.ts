import {
  getKey,
  getKeyHolder,
  getSqlKeyFromProxyCallback,
  KeyHolder,
} from 'typeorm-extensions/utils/proxy-key.utils';
import { UserEntity } from '../models';
import { ImageEntity } from '../models';

describe('getKey', () => {
  it('SHOULD return single column name', () => {
    const key = getKey<UserEntity>((u) => u.id);

    expect(key).toBe('id');
  });

  it('SHOULD return column name for different properties', () => {
    expect(getKey<UserEntity>((u) => u.email)).toBe('email');
    expect(getKey<UserEntity>((u) => u.firstName)).toBe('firstName');
    expect(getKey<UserEntity>((u) => u.lastName)).toBe('lastName');
    expect(getKey<UserEntity>((u) => u.createdAt)).toBe('createdAt');
  });

  it('SHOULD return relation.column path for nested access', () => {
    const key = getKey<UserEntity>((u) => u.images.url);

    expect(key).toBe('images.url');
  });

  it('SHOULD return relation name for single-level relation access', () => {
    const key = getKey<UserEntity>((u) => u.images);

    expect(key).toBe('images');
  });

  it('SHOULD handle array relation (OneToMany) traversal without type error', () => {
    // UserEntity.images is ImageEntity[] — this should unwrap the array and allow .url access
    const key = getKey<UserEntity>((u) => u.images.url);

    expect(key).toBe('images.url');
  });

  it('SHOULD handle ManyToOne relation traversal', () => {
    // ImageEntity.user is UserEntity (not an array)
    const key = getKey<ImageEntity>((i) => i.user.email);

    expect(key).toBe('user.email');
  });

  it('SHOULD return string as-is when passed a string', () => {
    const key = getKey<UserEntity>('custom.key');

    expect(key).toBe('custom.key');
  });

  it('SHOULD accept KeyHolder directly', () => {
    const holder = new KeyHolder(['alias', 'column']);
    const key = getKey<UserEntity>(holder);

    expect(key).toBe('alias.column');
  });
});

describe('getKeyHolder', () => {
  it('SHOULD return KeyHolder instance from callback', () => {
    const holder = getKeyHolder<UserEntity>((u) => u.id);

    expect(holder).toBeInstanceOf(KeyHolder);
    expect((holder as KeyHolder).getKeys()).toEqual(['id']);
  });

  it('SHOULD return KeyHolder with multiple keys for nested access', () => {
    const holder = getKeyHolder<UserEntity>((u) => u.images.url);

    expect(holder).toBeInstanceOf(KeyHolder);
    expect((holder as KeyHolder).getKeys()).toEqual(['images', 'url']);
  });

  it('SHOULD return KeyHolder as-is when passed directly', () => {
    const original = new KeyHolder(['test']);
    const holder = getKeyHolder<UserEntity>(original);

    expect(holder).toBe(original);
  });
});

describe('getSqlKeyFromProxyCallback', () => {
  it('SHOULD add prefix for single-level column', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>((u) => u.id, 'user');

    expect(key).toBe('user.id');
  });

  it('SHOULD not add prefix for multi-level (relation.column) path', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>(
      (u) => u.images.url,
      'user'
    );

    expect(key).toBe('images.url');
  });

  it('SHOULD wrap in quotes when useQuotes is true', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>(
      (u) => u.id,
      'user',
      true
    );

    expect(key).toBe('"user"."id"');
  });

  it('SHOULD wrap nested path in quotes when useQuotes is true', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>(
      (u) => u.images.url,
      'user',
      true
    );

    expect(key).toBe('"images"."url"');
  });

  it('SHOULD return string as-is when passed a string', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>('raw.key', 'user');

    expect(key).toBe('raw.key');
  });

  it('SHOULD work without prefix for single-level column', () => {
    const key = getSqlKeyFromProxyCallback<UserEntity>((u) => u.email);

    expect(key).toBe('email');
  });
});
