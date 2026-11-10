import '../../order-by-array-position.extension';
import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedSingleColumnKey, isTypedJsonPath } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { attachOrderByArrayPosition } from '../../../utils/order.utils';
import type { ArgsType } from '../../../types/util-types';

// declarations

export interface TypedOrderByArrayPositionMethods<Entity extends ObjectLiteral> {
  /**
   * Sets ORDER BY the position of the property's column value in `values` (PostgreSQL):
   * `array_position(:values, column)`. Rows whose value isn't in `values` come last.
   * Like `orderBy`, it replaces the previous ORDER BY. See `orderByArrayPosition`.
   */
  orderByArrayPositionTyped<Type extends ObjectLiteral = Entity>(
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds ORDER BY the position of the property's column value in `values` (PostgreSQL), like `addOrderBy`.
   */
  addOrderByArrayPositionTyped<Type extends ObjectLiteral = Entity>(
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedOrderByArrayPositionMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createOrderByArrayPositionTypedMethod = (replace: boolean) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
    this: SelectQueryBuilder<Entity>,
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    const methodName = replace ? 'orderByArrayPositionTyped' : 'addOrderByArrayPositionTyped';
    // a path into a JSON column is cast to the type of the values, as typed where methods do it,
    // so a number in the JSON is compared as a number, not as its text
    const value = Array.isArray(values) ? values.find((candidate) => candidate != null) : undefined;
    const column = getTypedSingleColumnKey<Type>(this, selection, methodName, { value });
    const jsonType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : undefined;
    // a JSON value of another type, a "n/a" among numbers, would fail the cast: it goes last instead
    const key =
      jsonType && isTypedJsonPath<Type>(this, selection)
        ? `CASE WHEN jsonb_typeof(CAST(${getTypedSingleColumnKey<Type>(this, selection, methodName, { accessor: 'json' })} AS jsonb)) = '${jsonType}' THEN ${column} END`
        : column;

    return attachOrderByArrayPosition(this, key, values, arrayType, replace);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    orderByArrayPositionTyped: createOrderByArrayPositionTypedMethod(true),
    addOrderByArrayPositionTyped: createOrderByArrayPositionTypedMethod(false),
  },
};

patchPrototype(SelectQueryBuilder, extension);
