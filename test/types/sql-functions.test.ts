import { Sql, tableHelper } from 'typeorm-extensions';

class Order {
  id: string;
  total: number;
  createdAt: Date;
  note: string | null;
}

const o = tableHelper<Order>('o');

Sql.count();
Sql.count(o.id, { distinct: true });
Sql.sum(o.total, { filter: o.where('note', 'IS NULL'), syntax: 'filter' });
Sql.max(o.createdAt);
Sql.coalesce(o.note, "''");
Sql.coalesce(Sql.sum(o.total), '0', Sql.max(o.total));
Sql.greatest(o.createdAt, 'NOW()');
Sql.nullif(Sql.lower(o.note), "''");
Sql.distinctOn(o.id, o.createdAt);

// @ts-expect-error COALESCE of one expression
Sql.coalesce(o.note);

// @ts-expect-error GREATEST of one expression
Sql.greatest(o.createdAt);

// @ts-expect-error DISTINCT ON needs an expression
Sql.distinctOn();

// @ts-expect-error not a column of the table
Sql.max(o.updatedAt);

// @ts-expect-error syntax is 'case' or 'filter'
Sql.min(o.total, { syntax: 'where' });
