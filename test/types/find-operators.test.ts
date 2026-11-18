import { Equal, ILike, In, IsNull, LessThan, MoreThanOrEqual, Not, SelectQueryBuilder } from 'typeorm';
import { EqualColumn, IsFalse, IsIn, IsTrue } from 'typeorm-extensions';

enum OrderStatus {
  Successful = 'successful',
  Failed = 'failed',
}

class Customer {
  id: string;
  name: string;
}

class Order {
  id: string;
  status: OrderStatus;
  total: number;
  paidAt: Date | null;
  deletedAt: Date | null;
  note: string | null;
  isGift: boolean;
  isArchived: boolean | null;
  customerId: string;
  customer: Customer;
}

declare const orders: SelectQueryBuilder<Order>;
declare const raw: SelectQueryBuilder<{ o: Order }>;

orders
  .whereTyped((o) => o.deletedAt, IsNull())
  .andWhereTyped((o) => o.paidAt, Not(IsNull()))
  .andWhereTyped((o) => o.status, Equal(OrderStatus.Successful))
  .andWhereTyped((o) => o.status, Not(Equal(OrderStatus.Failed)))
  .andWhereTyped((o) => o.status, In([OrderStatus.Successful, OrderStatus.Failed]))
  .andWhereTyped((o) => o.paidAt, MoreThanOrEqual(new Date()))
  .andWhereTyped((o) => o.total, LessThan(100))
  .andWhereTyped((o) => o.isGift, Equal(false))
  .andWhereTyped((o) => o.note, ILike('%gift%'))
  .andWhereTyped((o) => o.customer.id, EqualColumn('"o"."customerId"'))
  .orWhereTyped((o) => o.customerId, Not(EqualColumn('"o"."id"')));

raw.whereTyped((q) => q.o.status, Equal(OrderStatus.Successful));

// @ts-expect-error a string literal is not a member of the column's enum
orders.whereTyped((o) => o.status, Equal('successful'));

// @ts-expect-error a number column compared with a string
orders.andWhereTyped((o) => o.total, MoreThanOrEqual('100'));

// @ts-expect-error a boolean column compared with a string
orders.orWhereTyped((o) => o.isGift, Not(Equal('true')));

orders
  .whereTyped((o) => o.status, IsIn([OrderStatus.Successful, OrderStatus.Failed]))
  .andWhereTyped((o) => o.status, Not(IsIn([OrderStatus.Failed])))
  .andWhereTyped((o) => o.paidAt, IsIn([new Date(), '2026-01-01']))
  .andWhereTyped((o) => o.total, IsIn([] as number[]));

const statuses: readonly OrderStatus[] = [OrderStatus.Successful];
orders.whereTyped((o) => o.status, IsIn(statuses));

// TypeORM's In() is FindOperator<any> and fits any column
orders.whereTyped((o) => o.status, In(['successful']));

// @ts-expect-error a string literal is not a member of the column's enum
orders.whereTyped((o) => o.status, IsIn(['successful']));

// @ts-expect-error a string literal is not a member of the column's enum
orders.andWhereTyped((o) => o.status, Not(IsIn([OrderStatus.Failed, 'deleted'])));

// @ts-expect-error strings for a number column
orders.orWhereTyped((o) => o.total, IsIn(['1', '2']));

orders
  .whereTyped((o) => o.isGift, IsTrue())
  .andWhereTyped((o) => o.isGift, Not(IsFalse()))
  .andWhereTyped((o) => o.isArchived, Not(IsTrue()))
  .orWhereTyped((o) => o.isArchived, IsFalse());

// @ts-expect-error IS TRUE on a string column
orders.whereTyped((o) => o.note, IsTrue());

// @ts-expect-error IS FALSE on a number column
orders.andWhereTyped((o) => o.total, Not(IsFalse()));

// @ts-expect-error an operator takes no parameters
orders.whereTyped((o) => o.deletedAt, IsNull(), {});

// with an explicit `Type` the column can't be inferred, and the operator isn't checked
orders.whereTyped<{ o: Order }>((q) => q.o.status, Equal('successful'));
