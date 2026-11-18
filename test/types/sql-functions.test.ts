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

const mysql = Sql.for('mysql');
mysql.length(o.note);
mysql.for('better-sqlite3').ago(30, 'days');
Sql.case([[o.where('total', '> 100'), "'big'"]], "'small'");
Sql.over(Sql.rowNumber(), { partitionBy: o.id, orderBy: [`${o.createdAt} DESC`, o.id] });
Sql.over(Sql.lag(o.total, 1, '0'), { orderBy: o.createdAt });
Sql.addInterval(o.createdAt, -2, 'weeks');
Sql.extract('epoch', o.createdAt);
Sql.jsonbSet(o.note, ['a', 'b'], 'to_jsonb(1)', { createMissing: false });
Sql.stringAgg(o.note, ', ', { orderBy: o.createdAt });

// @ts-expect-error not a unit
Sql.interval(30, 'day');

// @ts-expect-error not a date part
Sql.extract('week', o.createdAt);

// @ts-expect-error a branch is a [condition, value] pair
Sql.case([[o.where('total', '> 100')]]);

// @ts-expect-error a path has at least one key
Sql.jsonbSet(o.note, [], 'to_jsonb(1)');

// @ts-expect-error not a database type
Sql.for('oracle-ish');

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
