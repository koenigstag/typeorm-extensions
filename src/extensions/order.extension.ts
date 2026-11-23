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
import { toReversedFlag, toSqlNullsOrder, toSqlOrderDirection } from '../utils/order.utils';
import { getColumnDatabaseName } from '../utils/query-builder.utils';
import {
  createUniqueParameterName,
  getDriverType,
  isMysqlLikeDriver,
  isUnquotedIdentifierPath,
} from '../utils/sql.utils';
import { isCalculatedColumn, selectCalculatedForOrder } from '../utils/calculated-column.utils';
import { assertStrictOrderInput, InvalidOrderError } from '../utils/order-input.utils';

/** An order filter, or the orders themselves: one order, or a list of them. */
export type OrderFilterInput<OrderEntity> =
  | OrderFilter<OrderEntity>
  | OrderParam<OrderEntity>
  | readonly OrderParam<OrderEntity>[]
  | null
  | undefined;

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SelectQueryBuilder<Entity> {
    applyOrder<OrderEntity extends ObjectLiteral>(
      orderBy: OrderParam<OrderEntity>,
      options?: ApplyOrderOptions
    ): this;
    applyOrderFilter<OrderEntity extends ObjectLiteral>(
      orderFilter: OrderFilterInput<OrderEntity>,
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
      orderFilter: OrderFilterInput<OrderEntity>,
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
  assertOrderParam(orderBy);

  const defaultAlias = builder.alias;
  const {
    useQuotes,
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

  assertStrictOrderInput(field as string, otherTableAlias, nullsOrder);

  const alias =
    otherTableAlias || customAlias ||
    (alwaysAliasFields.includes(field as string) ? defaultAlias : undefined);

  const reversed = toReversedFlag(isReversed);
  const order =
    reversed !== undefined && isNil(direction)
      ? (reversed ? 'DESC' : 'ASC')
      : toSqlOrderDirection(direction);

  const nulls = toSqlNullsOrder(nullsOrder) ?? defaultNullsOrder;

  // a @CalculatedColumn has no column: order by its value, selected with addSelectCalculated
  const calculatedAlias = alias ?? defaultAlias;

  if (isCalculatedColumn(builder, field as string, calculatedAlias)) {
    return {
      selector: selectCalculatedForOrder(builder, field as string, calculatedAlias, 'applyOrder'),
      order,
      nulls,
    };
  }

  const fieldName = field as string;
  // TypeORM maps an unquoted `alias.property` to the column itself; anything else must name the
  // column: `@Column({ name: 'created_at' }) createdAt` is ordered by "created_at", not "createdAt"
  const databaseName = getColumnDatabaseName(builder, alias, fieldName);

  if (useQuotes === false) {
    // written into the SQL as is, so only names get through: a field from a request may be anything
    assertUnquotedPath(fieldName, 'field');

    if (alias) {
      assertUnquotedPath(alias, 'alias');
    }

    return { selector: alias ? `${alias}.${fieldName}` : databaseName ?? fieldName, order, nulls };
  }

  // take / skip with joins orders the inner query only by `alias.property`: for `"user"."name"` it looks
  // for an alias named `"user"` and throws
  if (
    useQuotes === undefined &&
    alias &&
    databaseName !== undefined &&
    isUnquotedIdentifierPath(alias) &&
    isUnquotedIdentifierPath(fieldName)
  ) {
    return { selector: `${alias}.${fieldName}`, order, nulls };
  }

  const table = tableHelper<OrderEntity>(alias, { useQuotes: useQuotes ?? defaultUseQuotes, driver: getDriverType(builder) });

  return {
    selector: table.column((databaseName ?? fieldName) as keyof OrderEntity),
    order,
    nulls,
  };
}

function assertOrderParam(orderBy: unknown): void {
  const param = orderBy as Partial<Record<keyof OrderParam<ObjectLiteral>, unknown>> | null;

  if (
    !param ||
    typeof param !== 'object' ||
    typeof param.field !== 'string' ||
    param.field === '' ||
    (!isNil(param.tableAlias) && typeof param.tableAlias !== 'string')
  ) {
    throw new InvalidOrderError(
      `applyOrder expects an order such as { field: 'createdAt', direction: 'desc' }, got ${
        param === null ? 'null' : typeof param === 'object' ? 'an object without a string field' : typeof param
      }`,
      'order',
      orderBy
    );
  }
}

function assertUnquotedPath(name: string, label: 'field' | 'alias'): void {
  if (!isUnquotedIdentifierPath(name)) {
    throw new InvalidOrderError(`applyOrder with useQuotes: false takes column names only, got the ${label} "${name}"`, label, name);
  }
}

/**
 * MySQL has no NULLS FIRST / LAST: order by whether the value is NULL first. The flag is selected under an
 * alias, the form TypeORM can order by together with take and joins.
 */
function addNullsOrder<QB extends SelectQueryBuilder<any>>(
  builder: QB,
  selector: string,
  nulls: 'NULLS FIRST' | 'NULLS LAST'
): QB {
  // a calculated column is ordered by the alias of its selection, which another selection can't name
  const expression =
    builder.expressionMap.selects.find((select) => select.aliasName === selector)?.selection ?? selector;
  const nullsAlias = createUniqueParameterName('nulls').toLowerCase();

  return builder
    .addSelect(`(${expression}) IS NULL`, nullsAlias)
    .addOrderBy(nullsAlias, nulls === 'NULLS LAST' ? 'ASC' : 'DESC');
}

function applyOrder<QB extends SelectQueryBuilder<any>, OrderEntity extends ObjectLiteral>(
  builder: QB,
  orderBy: OrderParam<OrderEntity>,
  options?: ApplyOrderOptions
): QB {
  const { resetPreviousOrder = false } = options ?? {};

  const { selector, order, nulls } = getOrderOption(builder, orderBy, options);

  const query = resetPreviousOrder ? builder.orderBy() : builder;

  if (nulls && isMysqlLikeDriver(getDriverType(builder))) {
    return addNullsOrder(query, selector, nulls).addOrderBy(selector, order);
  }

  return query.addOrderBy(selector, order, nulls);
}

// the orders themselves: a list, or one order (an object with a field), as a request filter hands them over
const isOrderList = (input: unknown): boolean =>
  Array.isArray(input) || (typeof input === 'object' && input !== null && 'field' in input && !('orderBy' in input));

function applyOrderFilter<QB extends SelectQueryBuilder<any>, OrderEntity extends ObjectLiteral>(
  builder: QB,
  orderFilter: OrderFilterInput<OrderEntity>,
  options?: ApplyOrderOptions
): QB {
  const orderBy: unknown = isOrderList(orderFilter) ? orderFilter : (orderFilter as OrderFilter<OrderEntity> | null | undefined)?.orderBy;

  if (isNil(orderBy)) {
    return builder;
  }

  // a query string gives one order as an object: `?orderBy[field]=id`
  const orders = (Array.isArray(orderBy) ? orderBy : [orderBy]) as OrderParam<OrderEntity>[];

  return orders.reduce(
    (acc, order, index) =>
      acc.applyOrder<OrderEntity>(order, {
        ...options,
        resetPreviousOrder: index === 0 ? options?.resetPreviousOrder : false,
      }) as QB,
    builder
  );
}
