import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where-is-in.extension';
import { setupTest } from '../test-utils';
import { UserEntity } from '../models';

// `useQuotes` was removed from the typed where options in 2.0: typed keys are always quoted
setupTest('typed-where.options', undefined, (context) => {
  it('SHOULD reject useQuotes at compile time and quote the key anyway', () => {
    const query = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');

    // @ts-expect-error whereTyped options have no useQuotes
    const where = query().whereTyped((u) => u.id, '=', 1, { useQuotes: false });
    // @ts-expect-error whereIsInTyped takes no options
    const whereIn = query().whereIsInTyped((u) => u.id, [1], { useQuotes: false });

    expect(where.getQuery()).toMatch(/WHERE "user"\."id" = :where\w+/);
    expect(whereIn.getQuery()).toMatch(/WHERE "user"\."id" IN \(/);

    // addValue stays
    expect(query().whereTyped((u) => u.id, '= :id', { id: 1 }, { addValue: false }).getQuery()).toMatch(
      /WHERE "user"\."id" = :id/,
    );
  });
});
