import { QueryBuilder } from 'typeorm';
import type { ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
import {
  COCKROACHDB_RESERVED_KEY_WORDS,
  POSTGRES_RESERVED_KEY_WORDS,
  ReservedQualifier,
  scanReservedQualifiers,
  toReservedWordSet,
} from './reserved-qualifier.utils';
import { getDriverType, isPostgresLikeDriver } from './sql.utils';

const NAME_AFTER_DOT = /^\s*\.\s*("(?:[^"]|"")*"|[A-Za-z_][\w$]*|\*)/;

/** `"order"."userId"` for `order."userId"` / `order.userId`, `"order".*` for `order.*`. */
function toQuotedReference(sql: string, { word, index }: ReservedQualifier): string {
  const name = NAME_AFTER_DOT.exec(sql.slice(index + word.length))?.[1] ?? 'column';
  const quotedName = name.startsWith('"') || name === '*' ? name : `"${name}"`;

  return `"${word}".${quotedName}`;
}

/** The SQL of a query names a reserved word as a qualifier without quotes; see `enableReservedQualifierGuard`. */
export class ReservedQualifierError extends Error {
  /** The SQL of the query, as the driver gets it. */
  readonly sql: string;
  /** Each reserved word used as a qualifier, in the order of the SQL. */
  readonly qualifiers: ReservedQualifier[];

  constructor(sql: string, qualifiers: ReservedQualifier[]) {
    const [first] = qualifiers;
    const found = qualifiers.map(({ word, snippet }) => `"${word}" in ${snippet}`).join('; ');

    super(
      `Reserved word used as a qualifier without quotes: ${found}. ` +
        `PostgreSQL reads it as the key word, not as an alias, and rejects the query. ` +
        (first
          ? `Quote both halves, ${toQuotedReference(sql, first)}, or build the reference with tableHelper or the typed methods`
          : '')
    );

    this.name = 'ReservedQualifierError';
    this.sql = sql;
    this.qualifiers = qualifiers;
  }
}

type GuardWordsOption = {
  /**
   * The words to report, instead of the default list of the database (`POSTGRES_RESERVED_KEY_WORDS`,
   * `COCKROACHDB_RESERVED_KEY_WORDS` on CockroachDB). Spread a default list to extend it.
   */
  words?: readonly string[];
};

export type ReservedQualifierGuardOptions = GuardWordsOption &
  (
    | {
        /** `'throw'` (the default): the query rejects with a `ReservedQualifierError` before it runs. */
        mode?: 'throw';
      }
    | {
        /** `'warn'`: the query runs, and the error is passed to `onViolation`. */
        mode: 'warn';
        /** Reports the error the query would throw in `'throw'` mode; `console.warn` by default. */
        onViolation?: (violation: ReservedQualifierError) => void;
      }
  );

type GuardState = {
  mode: 'throw' | 'warn';
  words?: ReadonlySet<string>;
  onViolation: (violation: ReservedQualifierError) => void;
};

let guard: GuardState | undefined;
let installed = false;
let lastScan: { sql: string; words: ReadonlySet<string>; qualifiers: ReservedQualifier[] } | undefined;

const reportViolation = (violation: ReservedQualifierError): void => console.warn(violation);

function checkQuery(queryBuilder: QueryBuilder<ObjectLiteral>, sql: string, state: GuardState): void {
  const driver = getDriverType(queryBuilder as unknown as WhereExpressionBuilder);

  if (typeof sql !== 'string' || !isPostgresLikeDriver(driver)) {
    return;
  }

  const words =
    state.words ??
    toReservedWordSet(driver === 'cockroachdb' ? COCKROACHDB_RESERVED_KEY_WORDS : POSTGRES_RESERVED_KEY_WORDS);

  // the same SQL again, as a query run in a loop: one scan
  const qualifiers =
    lastScan && lastScan.sql === sql && lastScan.words === words
      ? lastScan.qualifiers
      : scanReservedQualifiers(sql, words);

  lastScan = { sql, words, qualifiers };

  if (qualifiers.length === 0) {
    return;
  }

  const violation = new ReservedQualifierError(sql, qualifiers);

  if (state.mode === 'throw') {
    throw violation;
  }

  state.onViolation(violation);
}

// every query of every builder gets its SQL here before it runs: getMany, getRawMany, getOne, getCount, stream,
// execute; getSql() too. getQuery() isn't checked: a subquery's SQL is checked as part of the query it is in
function installGuard(): void {
  if (installed) {
    return;
  }

  installed = true;

  const getQueryAndParameters = QueryBuilder.prototype.getQueryAndParameters;

  QueryBuilder.prototype.getQueryAndParameters = function (this: QueryBuilder<ObjectLiteral>) {
    const queryAndParameters = getQueryAndParameters.call(this);

    if (guard) {
      checkQuery(this, queryAndParameters[0], guard);
    }

    return queryAndParameters;
  };
}

/**
 * Checks the SQL of every query builder on PostgreSQL and CockroachDB for a reserved word used as a qualifier
 * without quotes, such as `order."userId"` or `user.id` (`findBareReservedQualifiers`), before the query runs.
 * TypeORM quotes the aliases it writes, so such a word comes from SQL written by hand, which PostgreSQL rejects.
 *
 * Off by default. A second call replaces the options. Other databases aren't checked.
 */
export function enableReservedQualifierGuard(options: ReservedQualifierGuardOptions = {}): void {
  const mode = options.mode ?? 'throw';

  if (mode !== 'throw' && mode !== 'warn') {
    throw new TypeError(`Invalid mode ${JSON.stringify(mode)} of the reserved qualifier guard: 'throw' or 'warn'`);
  }

  guard = {
    mode,
    words: options.words === undefined ? undefined : toReservedWordSet(options.words),
    onViolation: (options.mode === 'warn' && options.onViolation) || reportViolation,
  };

  installGuard();
}

/** Turns the check of `enableReservedQualifierGuard` off. */
export function disableReservedQualifierGuard(): void {
  guard = undefined;
  lastScan = undefined;
}
