import {
  disableReservedQualifierGuard,
  enableReservedQualifierGuard,
  findBareReservedQualifiers,
  POSTGRES_RESERVED_KEY_WORDS,
  ReservedQualifier,
  ReservedQualifierError,
  ReservedQualifierGuardOptions,
} from 'typeorm-extensions';

enableReservedQualifierGuard();
enableReservedQualifierGuard({ mode: 'throw' });
enableReservedQualifierGuard({ words: [...POSTGRES_RESERVED_KEY_WORDS, 'left'] });
enableReservedQualifierGuard({
  mode: 'warn',
  onViolation: (violation) => {
    const sql: string = violation.sql;
    const qualifiers: ReservedQualifier[] = violation.qualifiers;
    const error: Error = violation;

    return [sql, qualifiers, error];
  },
});
enableReservedQualifierGuard({ mode: 'warn' });
disableReservedQualifierGuard();

const options: ReservedQualifierGuardOptions = { mode: 'warn', words: ['order'] };
enableReservedQualifierGuard(options);

// @ts-expect-error onViolation reports in warn mode only
enableReservedQualifierGuard({ onViolation: () => undefined });
// @ts-expect-error onViolation reports in warn mode only
enableReservedQualifierGuard({ mode: 'throw', onViolation: () => undefined });
// @ts-expect-error not a mode
enableReservedQualifierGuard({ mode: 'error' });
// @ts-expect-error a list of words
enableReservedQualifierGuard({ words: 'order' });

const [found]: ReservedQualifier[] = findBareReservedQualifiers('order."userId" = $1', ['order', 'user']);
const word: string = found.word;
const index: number = found.index;
const snippet: string = found.snippet;

// @ts-expect-error the defaults can't be changed
POSTGRES_RESERVED_KEY_WORDS.push('left');

const error = new ReservedQualifierError('order.id', [found]);
const thrown: Error = error;

export { word, index, snippet, thrown };
