import type {
  OrderParam,
  OrderFilter,
} from '../../types/interfaces/ordering.interface';
import type { ApplyOrderOptions } from '../../types/extensions/order.types';

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
