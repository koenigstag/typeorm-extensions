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
Sql.coalesce(Sql.sum(o.total), 0);
Sql.case([[`${o.total} > 0`, 1]], -1);
Sql.lag(o.total, 1, 0);
Sql.count({ filter: `${o.total} > 0` });
Sql.for('postgres', { syntax: 'filter' }).count({ filter: `${o.total} > 0` });
Sql.addInterval(o.note, { sql: ':minutes' }, 'minutes');
Sql.percentileCont(0.5, o.total);
Sql.jsonbMerge(o.note, 'CAST(:patch AS jsonb)');
// @ts-expect-error syntax is 'case' or 'filter'
Sql.for('postgres', { syntax: 'where' });
// @ts-expect-error an amount is a number or { sql }
Sql.ago(':days', 'days');
// @ts-expect-error a condition is SQL, not a number
Sql.case([[1, o.total]]);
// @ts-expect-error LOWER takes a text expression
Sql.lower(1);
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

Sql.json(o.note, 'a', 0);
Sql.jsonText(o.note, 'a', 'b');
Sql.jsonBuildObject({ id: o.id, total: Sql.round(o.total, 2) });
Sql.jsonbBuildObject({ id: o.id });
Sql.arrayAgg(o.id, { distinct: true, orderBy: [o.id], filter: o.where('note', 'IS NULL') });
Sql.jsonAgg(Sql.jsonbBuildObject({ id: o.id }), { orderBy: `${o.createdAt} DESC` });
Sql.jsonbAgg(o.id);
Sql.abs(o.total);
Sql.floor(Sql.ceil(o.total));
Sql.atTimeZone(o.createdAt, 'Europe/Kyiv');
Sql.atTimeZone(o.createdAt, { sql: o.note });
Sql.dateTrunc('day', o.createdAt, '+02:00');

// @ts-expect-error a path has at least one key
Sql.jsonText(o.note);

// @ts-expect-error a key is a string or an index
Sql.json(o.note, true);

// @ts-expect-error not a date_trunc unit
Sql.dateTrunc('days', o.createdAt);

// @ts-expect-error a zone column is { sql }
Sql.atTimeZone(o.createdAt, { column: 'note' });

// @ts-expect-error jsonAgg has no syntax option
Sql.jsonAgg(o.id, { syntax: 'case' });
