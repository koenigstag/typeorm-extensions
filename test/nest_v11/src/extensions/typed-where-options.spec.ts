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
});
