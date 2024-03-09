import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type {
  OrderBy,
  OrderFilter,
} from '../types/interfaces/ordering.interface';
import { stringToSQLIdentifier } from '../utils/string.utils';
import {
  defaultNullsOrder,
  defaultOrderDirection,
  defaultUseDoubleQuotes,
} from '../constants';

export type ApplyOrderOptions = {
  useDoubleQuotes?: boolean;
};

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity>(
      orderBy: OrderBy<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
    applyOrderFilter<OrderEntity>(
      orderFilter: OrderFilter<OrderEntity>,
      options?: ApplyOrderOptions
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.applyOrder = function <OrderEntity>(
  orderBy: OrderBy<OrderEntity>,
  options?: ApplyOrderOptions
) {
  const { useDoubleQuotes = defaultUseDoubleQuotes } = options ?? {};

  const { field, direction, nulls } = orderBy;

  const sort = useDoubleQuotes
    ? stringToSQLIdentifier(field as string)
    : (field as string);
  const order = (direction ?? defaultOrderDirection).toUpperCase() as
    | 'ASC'
    | 'DESC';
  const nullsOrder = `NULLS ${(nulls ?? defaultNullsOrder).toUpperCase()}` as
    | 'NULLS LAST'
    | 'NULLS FIRST';

  return this.addOrderBy(sort, order, nullsOrder);
};

SelectQueryBuilder.prototype.applyOrderFilter = function <OrderEntity>(
  orderFilter: OrderFilter<OrderEntity>,
  options?: ApplyOrderOptions
) {
  if (!orderFilter.orderBy) {
    return this;
  }

  orderFilter.orderBy?.forEach((orderBy) => {
    this.applyOrder(orderBy, options);
  });

  return this;
};

export {};
