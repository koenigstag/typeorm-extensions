import { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';
import {
  addSelectCalculatedColumn,
  CalculatedSelection,
  orderByCalculatedColumn,
} from '../../../utils/calculated-column.utils';
import { resolveTypedProperty } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';

// declarations

type CalculatedPropertyCallback<Type extends ObjectLiteral> = (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType;

export interface TypedCalculatedColumnMethods<Entity extends ObjectLiteral> {
  /**
   * `addSelectCalculated` with the `@CalculatedColumn` picked by a typed callback: `(user) => user.imagesCount`, or
   * `(q) => q.owner.imagesCount` for the entity of the joined alias `owner`. The callback starts at the root set with
   * `typed<Root>()`, else at the entity. Throws a `TypeError` if the property isn't a `@CalculatedColumn`.
   */
  addSelectCalculatedTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>, SubEntity extends ObjectLiteral = ObjectLiteral>(
    selection: CalculatedSelection<SubEntity>,
    property: CalculatedPropertyCallback<Type>
  ): this;

  /**
   * `orderByCalculated` with the `@CalculatedColumn` picked by a typed callback: ORDER BY its value, selected with
   * `addSelectCalculated` / `addSelectCalculatedTyped` first. Replaces the previous ORDER BY, like `orderBy`.
   */
  orderByCalculatedTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    property: CalculatedPropertyCallback<Type>,
    order?: 'ASC' | 'DESC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this;

  /** `addOrderByCalculated` with the `@CalculatedColumn` picked by a typed callback, like `addOrderBy`. */
  addOrderByCalculatedTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    property: CalculatedPropertyCallback<Type>,
    order?: 'ASC' | 'DESC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedCalculatedColumnMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createOrderByCalculatedTypedMethod = (method: 'orderBy' | 'addOrderBy') =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    property: CalculatedPropertyCallback<Type>,
    order?: 'ASC' | 'DESC',
    nulls?: 'NULLS FIRST' | 'NULLS LAST'
  ): SelectQueryBuilder<Entity> {
    const methodName = `${method}CalculatedTyped`;
    const { aliasName, propertyPath } = resolveTypedProperty<Type>(this, property, methodName);

    return orderByCalculatedColumn(this, method, propertyPath, order, nulls, aliasName, methodName);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    addSelectCalculatedTyped<
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = TypedRoot<Entity>,
      SubEntity extends ObjectLiteral = ObjectLiteral
    >(
      this: SelectQueryBuilder<Entity>,
      selection: CalculatedSelection<SubEntity>,
      property: CalculatedPropertyCallback<Type>
    ): SelectQueryBuilder<Entity> {
      const { aliasName, propertyPath } = resolveTypedProperty<Type>(this, property, 'addSelectCalculatedTyped');

      return addSelectCalculatedColumn(this, selection, propertyPath, aliasName, 'addSelectCalculatedTyped');
    },
    orderByCalculatedTyped: createOrderByCalculatedTypedMethod('orderBy'),
    addOrderByCalculatedTyped: createOrderByCalculatedTypedMethod('addOrderBy'),
  },
};

patchPrototype(SelectQueryBuilder, extension);
