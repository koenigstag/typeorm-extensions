import { tableHelper } from 'typeorm-extensions/utils/table.utils';
import { UserEntity } from '../models';

describe('tableHelper', () => {
  describe('column', () => {
    it('SHOULD return quoted alias.column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.column('id')).toBe('"user"."id"');
    });

    it('SHOULD return quoted column without alias', () => {
      const table = tableHelper<UserEntity>();

      expect(table.column('email')).toBe('"email"');
    });

    it('SHOULD override alias when passed as argument', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.column('id', 'u')).toBe('"u"."id"');
    });

    it('SHOULD return unquoted when useQuotes is false', () => {
      const table = tableHelper<UserEntity>('user', { useQuotes: false });

      expect(table.column('id')).toBe('user.id');
    });

    it('SHOULD return unquoted column without alias when useQuotes is false', () => {
      const table = tableHelper<UserEntity>(undefined, { useQuotes: false });

      expect(table.column('firstName')).toBe('firstName');
    });
  });

  describe('where', () => {
    it('SHOULD return column with expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.where('id', '= :id')).toBe('"user"."id" = :id');
    });

    it('SHOULD return column only when no expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.where('id')).toBe('"user"."id"');
    });
  });

  describe('join', () => {
    it('SHOULD return alias.relation', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.join('images')).toBe('user.images');
    });
  });

  describe('joinOn', () => {
    it('SHOULD return column with expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.joinOn('id', '= image.userId')).toBe('"user"."id" = image.userId');
    });
  });

  describe('isNull', () => {
    it('SHOULD return column IS NULL', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.isNull('email')).toBe('"user"."email" IS NULL');
    });
  });

  describe('isNotNull', () => {
    it('SHOULD return column IS NOT NULL', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.isNotNull('email')).toBe('"user"."email" IS NOT NULL');
    });
  });

  describe('count', () => {
    it('SHOULD return COUNT with specific column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.count('id')).toBe('CAST(COUNT("user"."id") AS integer)');
    });

    it('SHOULD return COUNT with alias.* when no column', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.count()).toBe('CAST(COUNT("user".*) AS integer)');
    });

    it('SHOULD include count expression', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.count('id', 'FILTER (WHERE "user"."id" > 5)')).toBe(
        'CAST(COUNT("user"."id" FILTER (WHERE "user"."id" > 5)) AS integer)'
      );
    });
  });

  describe('cast', () => {
    it('SHOULD wrap expression in CAST', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.cast('"user"."id"', 'text')).toBe('CAST("user"."id" AS text)');
    });
  });

  describe('jsonField', () => {
    it('SHOULD return column with default ->> operator', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonField('firstName', 'nested')).toBe('"user"."firstName" ->> \'nested\'');
    });

    it('SHOULD use custom json operator', () => {
      const table = tableHelper<UserEntity>('user');

      expect(table.jsonField('firstName', 'nested', '->')).toBe('"user"."firstName" -> \'nested\'');
    });
  });
});
