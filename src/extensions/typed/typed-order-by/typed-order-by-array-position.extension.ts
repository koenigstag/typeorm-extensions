import '../../order-by-array-position.extension';
import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { attachOrderByArrayPosition } from '../../../utils/order.utils';
import type { ArgsType } from '../../../types/util-types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

export interface TypedOrderByArrayPositionMethods<Entity extends ObjectLiteral> {
  /**
   * Sets ORDER BY the position of the property's column value in `values` (PostgreSQL):
   * `array_position(:values, column)`. Rows whose value isn't in `values` come last.
   * Like `orderBy`, it replaces the previous ORDER BY. See `orderByArrayPosition`.
   */
  orderByArrayPositionTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds ORDER BY the position of the property's column value in `values` (PostgreSQL), like `addOrderBy`.
   */
  addOrderByArrayPositionTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
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
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    const methodName = replace ? 'orderByArrayPositionTyped' : 'addOrderByArrayPositionTyped';
    const column = getTypedSingleColumnKey<Type>(this, selection, methodName);

    return attachOrderByArrayPosition(this, column, values, arrayType, replace);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    orderByArrayPositionTyped: createOrderByArrayPositionTypedMethod(true),
    addOrderByArrayPositionTyped: createOrderByArrayPositionTypedMethod(false),
  },
};

patchPrototype(SelectQueryBuilder, extension);
