import type { ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
import type {
  SearchSelector,
  SimilaritySelectors,
  WeightedSearchSelector,
} from '../types/extensions/search.types';
import { getTypedColumnKey, isColumnKey } from './query-builder.utils';
import { assertFiniteNumber, TrigramColumn } from './search.utils';

const isWeighted = <Type extends ObjectLiteral>(selector: unknown): selector is WeightedSearchSelector<Type> =>
  typeof selector === 'object' && selector !== null && 'column' in selector;

/**
 * The columns and raw expressions of search selectors, in order. A typed key is used as is inside a function, and on
 * the left of an operator in parentheses unless it is a plain column: pg_trgm's `%` binds tighter than `->>` and `||`,
 * so `"a"."meta" ->> 'name' % :t` would read as `"a"."meta" ->> ('name' % :t)`. A raw `{ sql }` expression is in
 * parentheses everywhere. With `allowWeights` a selector may be `{ column, weight }`.
 */
export function getSearchColumns<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  selectors: SimilaritySelectors<Type>,
  methodName: string,
  allowWeights = false
): TrigramColumn[] {
  const list: ReadonlyArray<unknown> = typeof selectors === 'function' ? [selectors] : selectors;
  // no columns to search in: matching nothing or everything silently would hide the bug
  const emptyError = new TypeError(`${methodName} expects a non-empty array of columns to search in`);

  if (!Array.isArray(list) || list.length === 0) {
    throw emptyError;
  }

  const resolve = (selector: SearchSelector<Type>, weight: number | undefined): TrigramColumn[] => {
    const withWeight = (column: TrigramColumn): TrigramColumn => (weight === undefined ? column : { ...column, weight });

    if (typeof selector === 'function') {
      const keys = getTypedColumnKey<Type>(builder, selector);

      return (Array.isArray(keys) ? keys : [keys]).map((key) =>
        withWeight({ sql: key, operand: isColumnKey(key) ? key : `(${key})` })
      );
    }

    if (selector && typeof selector === 'object' && typeof selector.sql === 'string' && selector.sql.trim()) {
      // in parentheses: the expression may have operators that bind looser than ILIKE or `%`
      const sql = `(${selector.sql})`;

      return [withWeight({ sql, operand: sql })];
    }

    throw new TypeError(`${methodName} expects a typed callback or { sql: string }, got ${JSON.stringify(selector)}`);
  };

  const columns = list.flatMap((selector) =>
    allowWeights && isWeighted<Type>(selector)
      ? resolve(selector.column, assertFiniteNumber(selector.weight, 'weight', methodName))
      : resolve(selector as SearchSelector<Type>, undefined)
  );

  if (columns.length === 0) {
    throw emptyError;
  }

  return columns;
}
