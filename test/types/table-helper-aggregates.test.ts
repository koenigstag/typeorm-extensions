import { tableHelper } from 'typeorm-extensions';

class Order {
  id: number;
  amountCents: number;
  refundedCents?: bigint | null;
  status: string;
}

const order = tableHelper<Order>('order');

order.sum('amountCents', { filter: order.where('status', "= 'paid'") });
order.sum('refundedCents');
order.arrayAgg('status', { distinct: true, orderBy: ['status', 'DESC'] });

// @ts-expect-error not a number column
order.sum('status');
// @ts-expect-error not a column of the entity
order.arrayAgg('total');
// @ts-expect-error ordered by a column the entity doesn't have
order.arrayAgg('id', { orderBy: 'position' });
