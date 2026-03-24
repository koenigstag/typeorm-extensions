/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type {
  OrderParam,
  OrderFilter,
  OrderType,
} from '../types/interfaces/ordering.interface';
import {
  defaultNullsOrder,
  defaultOrderDirection,
  defaultUseQuotes,
} from '../constants';
import { ObjectLiteral } from 'typeorm';
import { isNil } from '../utils/common.utils';
import type { ApplyOrderOptions } from '../types/extensions/order.types';
import { patchPrototype } from '../utils/prototype.utils';
import { tableHelper } from '../utils/table.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity extends ObjectLiteral>(
      orderBy: OrderParam<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
    applyOrderFilter<OrderEntity extends ObjectLiteral>(
      orderFilter: OrderFilter<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<any>> } = {
  prototype: {
    applyOrder<Entity extends ObjectLiteral, OrderEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      orderBy: OrderParam<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity> {
      return applyOrder<SelectQueryBuilder<Entity>, OrderEntity>(
        this,
        orderBy,
        options
      );
    },
    applyOrderFilter<Entity extends ObjectLiteral, OrderEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      orderFilter: OrderFilter<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity> {
      return applyOrderFilter<SelectQueryBuilder<Entity>, OrderEntity>(
        this,
        orderFilter,
        options
      );
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

const alwaysAliasWhiteList = [
  'id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'deletedAt',
  'deleted_at',
];

function getOrderOption<OrderEntity extends ObjectLiteral>(
  orderBy: OrderParam<OrderEntity>,
  defaultAlias: string,
  options?: ApplyOrderOptions
): OrderType {
  const {
    useQuotes = defaultUseQuotes,
    alias: customAlias,
    alwaysAliasFields = alwaysAliasWhiteList,
  } = options ?? {};
  const {
    field,
    direction,
    isReversed,
    nulls: nullsOrder,
    tableAlias: otherTableAlias,
  } = orderBy;

  const alias =
    otherTableAlias || customAlias ||
    (alwaysAliasFields.includes(field as string) ? defaultAlias : undefined);

  const table = tableHelper<OrderEntity>(alias, { useQuotes });

  const selector = table.column(field);

  const order =
    typeof isReversed === 'boolean' && isNil(direction)
      ? (isReversed ? 'DESC' : 'ASC')
      : typeof direction === 'boolean'
        ? (direction ? 'ASC' : 'DESC')
        : typeof direction === 'number'
          ? (direction === -1 ? 'DESC' : 'ASC')
          : typeof direction === 'string' && /asc|desc/i.test(direction)
            ? (direction.toUpperCase() as 'ASC' | 'DESC')
            : defaultOrderDirection;

  const nulls =
    typeof nullsOrder === 'string' && /first|last/i.test(nullsOrder)
      ? (`NULLS ${nullsOrder.toUpperCase()}` as 'NULLS LAST' | 'NULLS FIRST')
      : defaultNullsOrder;

  return {
    selector,
    order,
    nulls,
  };
}

function applyOrder<QB extends SelectQueryBuilder<any>, OrderEntity extends ObjectLiteral>(
  builder: QB,
  orderBy: OrderParam<OrderEntity>,
  options?: ApplyOrderOptions
): QB {
  const { resetPreviousOrder = false } = options ?? {};

  const orderOption = getOrderOption(orderBy, builder.alias, options);

  const query = resetPreviousOrder ? builder.orderBy() : builder;

  return query.addOrderBy(
    orderOption.selector,
    orderOption.order,
    orderOption.nulls
  );
}

function applyOrderFilter<QB extends SelectQueryBuilder<any>, OrderEntity extends ObjectLiteral>(
  builder: QB,
  orderFilter: OrderFilter<OrderEntity>,
  options?: ApplyOrderOptions
): QB {
  if (orderFilter?.orderBy && !isNil(orderFilter?.orderBy)) {
    return orderFilter.orderBy.reduce(
      (acc, order, index) =>
        acc.applyOrder<OrderEntity>(order, {
          ...options,
          resetPreviousOrder: index === 0 ? options?.resetPreviousOrder : false,
        }) as QB,
      builder
    );
  }

  return builder;
}
