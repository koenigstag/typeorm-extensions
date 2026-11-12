/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type {
  OrderParam,
  OrderFilter,
  OrderType,
} from '../types/interfaces/ordering.interface';
import { defaultNullsOrder, defaultUseQuotes } from '../constants';
import { ObjectLiteral } from 'typeorm';
import { isNil } from '../utils/common.utils';
import type { ApplyOrderOptions } from '../types/extensions/order.types';
import { patchPrototype } from '../utils/prototype.utils';
import { tableHelper } from '../utils/table.utils';
import { toSqlOrderDirection } from '../utils/order.utils';
import { getColumnDatabaseName } from '../utils/query-builder.utils';
import { getDriverType } from '../utils/sql.utils';
import { isCalculatedColumn, selectCalculatedForOrder } from '../utils/calculated-column.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity extends ObjectLiteral>(
      orderBy: OrderParam<OrderEntity>,
      options?: ApplyOrderOptions
    ): this;
    applyOrderFilter<OrderEntity extends ObjectLiteral>(
      orderFilter: OrderFilter<OrderEntity>,
      options?: ApplyOrderOptions
    ): this;
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
  builder: SelectQueryBuilder<any>,
  orderBy: OrderParam<OrderEntity>,
  options?: ApplyOrderOptions
): OrderType {
  const defaultAlias = builder.alias;
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

  const order =
    typeof isReversed === 'boolean' && isNil(direction)
      ? (isReversed ? 'DESC' : 'ASC')
      : toSqlOrderDirection(direction);

  const nulls =
    typeof nullsOrder === 'string' && /first|last/i.test(nullsOrder)
      ? (`NULLS ${nullsOrder.toUpperCase()}` as 'NULLS LAST' | 'NULLS FIRST')
      : defaultNullsOrder;

  // a @CalculatedColumn has no column: order by its value, selected with addSelectCalculated
  const calculatedAlias = alias ?? defaultAlias;

  if (isCalculatedColumn(builder, field as string, calculatedAlias)) {
    return {
      selector: selectCalculatedForOrder(builder, field as string, calculatedAlias, 'applyOrder'),
      order,
      nulls,
    };
  }

  const table = tableHelper<OrderEntity>(alias, { useQuotes, driver: getDriverType(builder) });

  // TypeORM maps an unquoted `alias.property` to the column itself; anything else must name the
  // column: `@Column({ name: 'created_at' }) createdAt` is ordered by "created_at", not "createdAt"
  const column =
    alias && !useQuotes
      ? field
      : getColumnDatabaseName(builder, alias, field as string) ?? field;

  const selector = table.column(column as keyof OrderEntity);

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

  const orderOption = getOrderOption(builder, orderBy, options);

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
