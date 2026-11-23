import { isNil } from './common.utils';
import { toSqlNullsOrder } from './order.utils';
import { isUnquotedIdentifierPath } from './sql.utils';

/** The part of an order `applyOrder` could not take. */
export type InvalidOrderPart = 'order' | 'field' | 'tableAlias' | 'alias' | 'nulls';

/**
 * An order `applyOrder` / `applyOrderFilter` can't take: no order object with a string `field`, a name that
 * `useQuotes: false` would write into the SQL as is, or, with `enableStrictOrderInput`, a `field`,
 * `tableAlias` or `nulls` it doesn't recognise. A `TypeError`, as these errors were before it had a class.
 */
export class InvalidOrderError extends TypeError {
  /** What was wrong: the whole order, or one of its parts. */
  readonly part: InvalidOrderPart;
  /** The value that was rejected. */
  readonly value: unknown;

  constructor(message: string, part: InvalidOrderPart, value: unknown) {
    super(message);

    this.name = 'InvalidOrderError';
    this.part = part;
    this.value = value;
  }
}

let strict = false;

/**
 * Makes every `applyOrder` / `applyOrderFilter` reject, with an `InvalidOrderError`, an order whose `field` or
 * `tableAlias` is not a name (`firstName`, `user.firstName`) or whose `nulls` is not one it reads
 * (`first`, `last`, `NULLS FIRST`, `NULLS LAST`, in any case).
 *
 * Off by default: an order is then taken as given, its field and table alias quoted as one identifier each and
 * an unknown `nulls` left out. Turn it on once, where the extensions are loaded, when orders come from requests:
 * an order the database can't run is then refused before the query is built, by every caller, and can be
 * answered as a bad request. `direction` and `isReversed` stay lenient: whatever they hold orders one way or the
 * other.
 */
export function enableStrictOrderInput(): void {
  strict = true;
}

/** Turns the check of `enableStrictOrderInput` off. */
export function disableStrictOrderInput(): void {
  strict = false;
}

/** With `enableStrictOrderInput`: throws an `InvalidOrderError` for a name or a `nulls` the order can't take. */
export function assertStrictOrderInput(field: string, tableAlias: unknown, nulls: unknown): void {
  if (!strict) {
    return;
  }

  if (!isUnquotedIdentifierPath(field)) {
    throw new InvalidOrderError(`applyOrder takes a column name as the field, got "${field}"`, 'field', field);
  }

  if (!isNil(tableAlias) && (typeof tableAlias !== 'string' || !isUnquotedIdentifierPath(tableAlias))) {
    throw new InvalidOrderError(`applyOrder takes a name as the table alias, got "${String(tableAlias)}"`, 'tableAlias', tableAlias);
  }

  if (!isNil(nulls) && toSqlNullsOrder(nulls as never) === undefined) {
    throw new InvalidOrderError(
      `applyOrder takes first, last, NULLS FIRST or NULLS LAST as nulls, got "${String(nulls)}"`,
      'nulls',
      nulls
    );
  }
}
