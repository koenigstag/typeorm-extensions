import { ObjectLiteral, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { DeepUnwrapArray, KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import type { TypedGroupByOptions } from '../../../types/extensions/typed-group-by.types';
import { getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/** A value a column holds: a relation (`u => u.images`) or a JSON object is no column to group by. */
type GroupedColumn = string | number | boolean | Date | ArrayBufferView | ArrayBuffer | null | undefined;

/** One column, `user => user.id`, or several, `user => [user.id, user.email]`. */
type GroupBySelection<Type extends ObjectLiteral> = (proxy: DeepUnwrapArray<Type>) => GroupedColumn | GroupedColumn[];

export interface TypedGroupByMethods<Entity extends ObjectLiteral> {
  /**
   * Sets GROUP BY to the columns the callback selects: `user => user.id`, or several at once,
   * `user => [user.id, user.email]`. Replaces previously set GROUP BY.
   */
  groupByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    selection: GroupBySelection<Type>,
    options?: TypedGroupByOptions
  ): this;

  /**
   * Adds the columns the callback selects to GROUP BY.
   */
  addGroupByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    selection: GroupBySelection<Type>,
    options?: TypedGroupByOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedGroupByMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    groupByTyped<Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
      this: SelectQueryBuilder<Entity>,
      selection: KeyProxyCallback<Type>,
      options?: TypedGroupByOptions
    ) {
      // keys first: a JSON path throws before the previous GROUP BY is dropped
      const [first, ...rest] = toGroupByKeys<Type>(this, selection, options);

      if (first === undefined) {
        return this.groupBy();
      }

      return addGroupByKeys(this.groupBy(first), rest);
    },

    addGroupByTyped<Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
      this: SelectQueryBuilder<Entity>,
      selection: KeyProxyCallback<Type>,
      options?: TypedGroupByOptions
    ) {
      return addGroupByKeys(this, toGroupByKeys<Type>(this, selection, options));
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

function toGroupByKeys<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  selection: KeyProxyCallback<Type>,
  options?: TypedGroupByOptions
): string[] {
  const keys = getTypedSelectionKey<Type>(builder, selection, options?.useQuotes);

  return Array.isArray(keys) ? keys : [keys];
}

function addGroupByKeys<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  keys: string[]
): SelectQueryBuilder<Entity> {
  return keys.reduce((query, key) => query.addGroupBy(key), builder);
}
