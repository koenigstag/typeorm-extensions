import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type {
  OrderParam,
  OrderFilter,
  OrderType,
} from '../types/interfaces/ordering.interface';
import {
  defaultNullsOrder,
  defaultOrderDirection,
  defaultUseDoubleQuotes,
} from '../constants';
import { ObjectLiteral } from 'typeorm';
import { isNil } from '../utils/common.utils';
import { Identifier } from '../utils/identifier.utils';

const alwaysAliasWhiteList = [
  'id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'deletedAt',
  'deleted_at',
];

export type ApplyOrderOptions = {
  useDoubleQuotes?: boolean;
  alias?: string;
  alwaysAliasFields?: string[];
  resetPreviousOrder?: boolean;
};

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity>(
      orderBy: OrderParam<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
    applyOrderFilter<OrderEntity>(
      orderFilter: OrderFilter<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.applyOrder = function <
  Entity extends ObjectLiteral,
  OrderEntity
>(
  orderBy: OrderParam<OrderEntity>,
  options?: ApplyOrderOptions
): SelectQueryBuilder<Entity> {
  const { resetPreviousOrder = false } = options ?? {};

  const orderOption = getOrderOption(orderBy, this.alias, options);

  const query = resetPreviousOrder ? this.orderBy() : this;

  return query.addOrderBy(
    orderOption.selector,
    orderOption.order,
    orderOption.nulls
  );
};

SelectQueryBuilder.prototype.applyOrderFilter = function <
  Entity extends ObjectLiteral,
  OrderEntity
>(
  orderFilter: OrderFilter<OrderEntity>,
  options?: ApplyOrderOptions
): SelectQueryBuilder<Entity> {
  if (!isNil(orderFilter?.orderBy)) {
    return orderFilter.orderBy!.reduce(
      (acc, order, index) =>
        acc.applyOrder(order, {
          ...options,
          resetPreviousOrder: index === 0 ? options?.resetPreviousOrder : false,
        }),
      this as SelectQueryBuilder<Entity>
    );
  }

  return this;
};

export const getOrderOption = <OrderEntity>(
  orderBy: OrderParam<OrderEntity>,
  defaultAlias: string,
  options?: ApplyOrderOptions
): OrderType => {
  const {
    useDoubleQuotes = defaultUseDoubleQuotes,
    alias: customAlias,
    alwaysAliasFields = alwaysAliasWhiteList,
  } = options ?? {};
  const {
    field,
    direction = defaultOrderDirection,
    nulls: nullsOrder = defaultNullsOrder,
  } = orderBy;

  const alias =
    customAlias ??
    (alwaysAliasFields.includes(field as string) ? defaultAlias : undefined);

  const identifier = new Identifier(field, alias, useDoubleQuotes);

  const selector = identifier.fieldIdentifier();
  const order = direction.toUpperCase() as 'ASC' | 'DESC';

  const nulls = nullsOrder
    ? (`NULLS ${nullsOrder.toUpperCase()}` as 'NULLS LAST' | 'NULLS FIRST')
    : undefined;

  return {
    selector,
    order,
    nulls,
  };
};

export {};
