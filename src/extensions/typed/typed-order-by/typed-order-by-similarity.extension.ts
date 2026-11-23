import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { SimilarityOrderOptions, SimilaritySelectors } from '../../../types/extensions/search.types';
import { patchPrototype } from '../../../utils/prototype.utils';
import { createUniqueParameterName } from '../../../utils/sql.utils';
import {
  assertOrderAlias,
  assertTrigramDriver,
  buildSimilarityDistance,
  buildSimilarityScore,
  toSearchTerm,
} from '../../../utils/search.utils';
import { getSearchColumns } from '../../../utils/search-columns.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/** Order by trigram similarity to a term (PostgreSQL, `pg_trgm` extension). */
export interface TypedOrderBySimilarityMethods<Entity extends ObjectLiteral> {
  /**
   * Sets ORDER BY the similarity of the columns to `term` (PostgreSQL, pg_trgm), the most similar first and rows
   * without text to compare last: selects `similarity(column, :term)` under a lower-case alias and orders by it,
   * `DESC NULLS LAST`, which works with `take` / `skip` and joins too. Like `orderBy`, it replaces the previous
   * ORDER BY. Several columns need `options.combine`. A blank term changes nothing, so the query keeps its order.
   */
  orderBySimilarityTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selection: SimilaritySelectors<Type>,
    term: string | null | undefined,
    options?: SimilarityOrderOptions
  ): this;

  /**
   * Adds ORDER BY the similarity of the columns to `term` (PostgreSQL, pg_trgm), like `addOrderBy`.
   * See `orderBySimilarityTyped`.
   */
  addOrderBySimilarityTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selection: SimilaritySelectors<Type>,
    term: string | null | undefined,
    options?: SimilarityOrderOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedOrderBySimilarityMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createOrderBySimilarityTypedMethod = (replace: boolean) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    selection: SimilaritySelectors<Type>,
    term: string | null | undefined,
    options?: SimilarityOrderOptions
  ): SelectQueryBuilder<Entity> {
    const methodName = replace ? 'orderBySimilarityTyped' : 'addOrderBySimilarityTyped';
    assertTrigramDriver(this, methodName);
    const columns = getSearchColumns<Type>(this, selection, methodName, true);
    const { alias, direction, nulls = 'last', distance = false } = options ?? {};

    if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC') {
      throw new TypeError(`${methodName}: invalid direction "${direction}", expected "ASC" or "DESC"`);
    }

    if (nulls !== 'first' && nulls !== 'last') {
      throw new TypeError(`${methodName}: invalid nulls "${nulls}", expected "first" or "last"`);
    }

    const selectionAlias =
      alias === undefined
        ? // lower case: TypeORM writes the ORDER BY key unquoted, and PostgreSQL folds it
          createUniqueParameterName('similarity').toLowerCase()
        : assertOrderAlias(alias, methodName);
    const paramName = createUniqueParameterName('similarity');
    // built before a blank term returns: wrong options throw either way
    const expression = distance
      ? buildSimilarityDistance(columns, `:${paramName}`, options, methodName)
      : buildSimilarityScore(columns, `:${paramName}`, options, methodName);
    const value = toSearchTerm(term, methodName);

    if (value === undefined) {
      return this;
    }

    // ordered by the selection alias: TypeORM can't order by a function expression together with `take` and joins
    this.addSelect(expression, selectionAlias).setParameter(paramName, value);

    const order = direction ?? (distance ? 'ASC' : 'DESC');
    const nullsOrder = nulls === 'first' ? 'NULLS FIRST' : 'NULLS LAST';

    return replace
      ? this.orderBy(selectionAlias, order, nullsOrder)
      : this.addOrderBy(selectionAlias, order, nullsOrder);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    orderBySimilarityTyped: createOrderBySimilarityTypedMethod(true),
    addOrderBySimilarityTyped: createOrderBySimilarityTypedMethod(false),
  },
};

patchPrototype(SelectQueryBuilder, extension);
