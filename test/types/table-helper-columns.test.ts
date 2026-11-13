import { ObjectLiteral } from 'typeorm';
import { tableHelper, TableHelper } from 'typeorm-extensions';

class Order {
  id: number;
  userId: string;
  'first-name': string;
  // named like members of the helper
  alias: string;
  count: number;
}

const order = tableHelper<Order>('order');

const userId: string = order.userId;
const oddName: string = order['first-name'];
void userId;
void oddName;

// a column named like a member of the helper is the member there, and a column through column()
order.count('id');
order.column('count');
// @ts-expect-error count is the method, not the column
const countColumn: string = order.count;
void countColumn;
order.column('alias');

// @ts-expect-error not a column of the entity
void order.notAColumn;
// @ts-expect-error the columns are read-only
order.userId = 'user_id';

// plain row types too
const cte = tableHelper<Record<'utm_id' | 'total', unknown>>('cte');
const utmId: string = cte.utm_id;
void utmId;
// @ts-expect-error not a column of the row
void cte.utmId;

const typedHelper: TableHelper<Order> = order;
void typedHelper;

// the members stay usable in code generic over the entity
function idColumn<T extends ObjectLiteral & { id: number }>(alias: string): string {
  const table = tableHelper<T>(alias);

  return `${table.column('id')} ${table.where('id', '= :id')} ${table.count()}`;
}
void idColumn;

// given the entity class, the helper takes the entity's type from it
abstract class Base {
  createdAt: Date;
}
class Invoice extends Base {
  constructor(public number: string) {
    super();
  }
}

const invoice = tableHelper(Invoice, 'i');
const invoiceColumns: string[] = [invoice.number, invoice.createdAt, invoice.where('number', '= :n'), tableHelper(Base).createdAt];
void invoiceColumns;
const invoiceHelper: TableHelper<Invoice> = tableHelper(Invoice, 'i', { useQuotes: false });
void invoiceHelper;
// @ts-expect-error not a column of the entity
void invoice.total;
// @ts-expect-error the options come after the alias
tableHelper(Invoice, { useQuotes: false });
