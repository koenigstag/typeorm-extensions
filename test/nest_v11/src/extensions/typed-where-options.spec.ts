import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { setupTest, sqlOf } from '../test-utils';
import { UserEntity } from '../models';

// `useQuotes` was removed from the typed where options in 2.0: typed keys are always quoted
setupTest('typed-where.options', undefined, (context) => {
  it('SHOULD reject useQuotes at compile time and quote the key anyway', () => {
    const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

    // @ts-expect-error whereTyped options have no useQuotes
    const where = query().whereTyped((u) => u.id, '=', 1, { useQuotes: false });
    // @ts-expect-error whereIsInTyped takes no options
    const whereIn = query().whereIsInTyped((u) => u.id, [1], { useQuotes: false });

    expect(sqlOf(where)).toMatch(/WHERE "user"\."id" = :where\w+/);
    expect(sqlOf(whereIn)).toMatch(/WHERE "user"\."id" IN \(/);

    // several columns: no single meaning, and `where…` used to keep only the last one
    expect(() => query().whereTyped((u) => [u.id, u.email], '=', 1)).toThrow(
      /whereTyped expects the callback to select a single column, got 2/,
    );
    expect(() => query().orWhereIsNotInTyped((u) => [u.id, u.email], [1])).toThrow(
      /orWhereIsNotInTyped expects the callback to select a single column, got 2/,
    );

    // addValue stays
    expect(sqlOf(query().whereTyped((u) => u.id, '= :id', { id: 1 }, { addValue: false }))).toMatch(
      /WHERE "user"\."id" = :id/,
    );
  });

  it('SHOULD take one key in a params object whose value goes after the condition', () => {
    const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

    // only `id` was used, `email` dropped without a word; an empty object compared with NULL
    expect(() => query().whereTyped((u) => u.id, '=', { id: 1, email: 'a@b.c' })).toThrow(
      /params object .* got 2 keys \(id, email\)/,
    );
    expect(() => query().andWhereTyped((u) => u.id, '=', {})).toThrow(/got 0 keys/);

    // keys named in the condition, or a value itself, are as before
    expect(sqlOf(query().whereTyped((u) => u.id, 'BETWEEN :from AND :to', { from: 1, to: 3 }))).toMatch(
      /WHERE "user"\."id" BETWEEN :from AND :to/,
    );
    expect(sqlOf(query().whereTyped((u) => u.id, '=', { id: 1 }))).toMatch(/WHERE "user"\."id" = :where\w+/);
    expect(sqlOf(query().whereTyped((u) => u.createdAt, '<', new Date()))).toMatch(
      /WHERE "user"\."createdAt" < :where\w+/,
    );
  });

  // a bare undefined left the condition without an operand, `"user"."email" =`, a syntax error in the database
  it('SHOULD throw for an undefined value after an operator', () => {
    const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');
    const email: string | undefined = undefined;

    expect(() => query().whereTyped((u) => u.email, '=', email)).toThrow(/The value after ".*email\W* =" is undefined/);
    expect(() => query().orWhereTyped((u) => u.email, 'LIKE', email)).toThrow(/LIKE" is undefined/);

    expect(sqlOf(query().whereTyped((u) => u.email, 'IS NULL', email))).toMatch(/WHERE "user"\."email" IS NULL/);
    expect(sqlOf(query().whereTyped((u) => u.email, '=', null))).toMatch(/WHERE "user"\."email" = NULL/);
    expect(sqlOf(query().whereTyped((u) => u.email, '=', { email }))).toMatch(/WHERE "user"\."email" = NULL/);
  });
});
