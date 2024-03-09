import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { OrderBy, OrderFilter } from '../types/interfaces/ordering.interface';
import { stringToSQLIdentifier } from '../utils/string.utils';
import { defaultUseDoubleQuotes } from '../constants';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity>(
      orderBy: OrderBy<OrderEntity>,
      options?: { useDoubleQuotes?: boolean }
    ): SelectQueryBuilder<Entity>;
    applyOrderFilter<OrderEntity>(
      orderFilter: OrderFilter<OrderEntity>,
      options?: { useDoubleQuotes?: boolean }
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.applyOrder = function <OrderEntity>(
  orderBy: OrderBy<OrderEntity>,
  options?: { useDoubleQuotes?: boolean }
) {
  const { useDoubleQuotes = defaultUseDoubleQuotes } = options ?? {};

  return this.addOrderBy(
    useDoubleQuotes
      ? stringToSQLIdentifier(orderBy.field as string)
      : (orderBy.field as string),
    (orderBy.direction ?? 'ASC').toUpperCase() as 'ASC' | 'DESC',
    `NULLS ${(orderBy.nulls ?? 'LAST').toUpperCase() as 'LAST' | 'FIRST'}`
  );
};

SelectQueryBuilder.prototype.applyOrderFilter = function <OrderEntity>(
  orderFilter: OrderFilter<OrderEntity>,
  options?: { useDoubleQuotes?: boolean }
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
