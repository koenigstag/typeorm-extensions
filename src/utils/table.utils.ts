import { DatabaseType, getMetadataArgsStorage, ObjectLiteral } from "typeorm";
import { isMysqlLikeDriver, isPostgresLikeDriver, isSqliteLikeDriver, quoteIdentifier, quoteIdentifierPath } from './sql.utils';
import { buildJsonPath } from './json-path.utils';

export type TableHelperOptions = {
	useQuotes?: boolean;
	/** The database the SQL is for: MySQL and MariaDB quote identifiers with backticks. Double quotes without it. */
	driver?: DatabaseType;
};

type JsonFieldTuple<T, Depth extends 0[] = []> = Depth['length'] extends 4
	? [string, ...string[]]
	: {
		[K in keyof T & string]: [NonNullable<T[K]>] extends [Record<string, unknown>]
			? [K, ...JsonFieldTuple<NonNullable<T[K]>, [...Depth, 0]>] | [K]
			: [K]
	}[keyof T & string];

export type TableHelperCountOptions = {
	/** `COUNT(DISTINCT column)`: count the different values of the column. Needs a column. */
	distinct?: boolean;
	/** Count only the rows that match this condition, e.g. `t.where('status', "= 'active'")`. */
	filter?: string;
	/**
	 * How `filter` is written:
	 * - `'case'` (default): `COUNT(CASE WHEN filter THEN column END)`, in every database;
	 * - `'filter'`: `COUNT(column) FILTER (WHERE filter)`, PostgreSQL and SQLite 3.30+ only, a few percent faster on PostgreSQL.
	 */
	syntax?: 'case' | 'filter';
};

export type TableHelperJsonOptions = {
	/** `jsonb_build_object` / `jsonb_agg` instead of the `json` functions. PostgreSQL only. */
	jsonb?: boolean;
};

type ColumnName<T> = keyof T & string;

export type TableHelperJsonAggOptions<T> = TableHelperJsonOptions & {
	/** Orders the array by a column of the helper's table, ascending or in the given direction. Not on MySQL. */
	orderBy?: AggregateOrder<T>;
	/**
	 * Aggregates only the rows that match, e.g. `images.isNotNull('id')`: after a LEFT JOIN without a match
	 * the row has `NULL` columns, which would otherwise come out as `[{"id": null}]`. Not on MySQL.
	 */
	filter?: string;
};

/** Keys of the entity whose values are numbers. */
type NumericColumnName<T> = {
	[K in keyof T & string]: [NonNullable<T[K]>] extends [number | bigint] ? K : never;
}[keyof T & string];

type AggregateOrderTuple<T> = readonly [ColumnName<T>, ('ASC' | 'DESC')?];

type AggregateOrder<T> = ColumnName<T> | readonly [ColumnName<T>, 'ASC' | 'DESC'];

export type TableHelperSumOptions = {
	/** Sums only the rows that match this condition, e.g. `t.where('status', "= 'paid'")`. */
	filter?: string;
	/** How `filter` is written, as for `count`: `'case'` (default) or `'filter'` (PostgreSQL and SQLite 3.30+). */
	syntax?: 'case' | 'filter';
};

export type TableHelperArrayAggOptions<T> = {
	/** `array_agg(DISTINCT column)`: each value once. Then `orderBy` can only be the aggregated column. */
	distinct?: boolean;
	/** Orders the array by a column of the helper's table, ascending or in the given direction. */
	orderBy?: AggregateOrder<T>;
	/** Aggregates only the rows that match, e.g. `images.isNotNull('id')` after a LEFT JOIN without a match. */
	filter?: string;
};

/**
 * The argument of an aggregate and the clause after it for a `filter` written with `syntax`:
 * `CASE WHEN filter THEN argument END`, or `argument` and ` FILTER (WHERE filter)`.
 */
function filtered(
	method: string,
	argument: string,
	filter: string | undefined,
	syntax: unknown = 'case',
	driver?: DatabaseType
) {
	if (syntax !== 'case' && syntax !== 'filter') {
		throw new TypeError(`tableHelper.${method}(): syntax is 'case' or 'filter', got "${String(syntax)}"`);
	}

	if (filter && syntax === 'filter' && isMysqlLikeDriver(driver)) {
		throw new TypeError(`tableHelper.${method}(): MySQL / MariaDB have no FILTER (WHERE …), use syntax 'case'`);
	}

	if (!filter) {
		return { argument, suffix: '' };
	}

	return syntax === 'case'
		? { argument: `CASE WHEN ${filter} THEN ${argument} END`, suffix: '' }
		: { argument, suffix: ` FILTER (WHERE ${filter})` };
}

/** `orderBy` of an aggregate: its column, and the SQL after the argument, ` ORDER BY column [direction]`. */
function aggregateOrder<T>(method: string, orderBy: AggregateOrder<T>, toSql: (column: ColumnName<T>) => string) {
	const [column, direction] = (typeof orderBy === 'string' ? [orderBy] : orderBy) as AggregateOrderTuple<T>;

	if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC') {
		throw new TypeError(`tableHelper.${method}(): the order is 'ASC' or 'DESC', got "${String(direction)}"`);
	}

	return { column, sql: ` ORDER BY ${toSql(column)}${direction ? ` ${direction}` : ''}` };
}

/** A column of the helper's table whose property is a `Date`. */
type DateColumnName<T> = {
	[K in keyof T & string]: [NonNullable<T[K]>] extends [Date] ? K : never;
}[keyof T & string];

/** A date column of the helper's table, or an SQL expression: `{ sql: 'MAX("order"."paidAt")' }`. */
export type TableHelperExpression<T> = DateColumnName<T> | { sql: string };

/**
 * A time zone: a name or an ISO 8601 offset (`'Europe/Kyiv'`, `'UTC'`, `'+02:00'` = UTC+2), written into the SQL as an escaped string
 * literal; a column of the helper's table, `{ column: 'timezone' }`, with an optional `fallback` zone for `NULL`;
 * or an SQL expression, `{ sql: services.column('timezone') }`.
 */
export type TableHelperTimeZone<T> = string | { column: ColumnName<T>; fallback?: string } | { sql: string };

/** The units of PostgreSQL's `date_trunc`. */
export type DateTruncUnit =
	| 'microseconds'
	| 'milliseconds'
	| 'second'
	| 'minute'
	| 'hour'
	| 'day'
	| 'week'
	| 'month'
	| 'quarter'
	| 'year'
	| 'decade'
	| 'century'
	| 'millennium';

const DATE_TRUNC_UNITS: readonly DateTruncUnit[] = [
	'microseconds',
	'milliseconds',
	'second',
	'minute',
	'hour',
	'day',
	'week',
	'month',
	'quarter',
	'year',
	'decade',
	'century',
	'millennium',
];

function assertPostgres(method: string, driver: DatabaseType | undefined) {
	if (driver !== undefined && !isPostgresLikeDriver(driver)) {
		throw new TypeError(`tableHelper.${method}(): PostgreSQL only, the driver is "${driver}"`);
	}
}

function toExpression<T>(value: TableHelperExpression<T>, toColumn: (column: ColumnName<T>) => string): string {
	return typeof value === 'string' ? toColumn(value) : value.sql;
}

function toTimeZone<T>(method: string, timeZone: TableHelperTimeZone<T>, toColumn: (column: ColumnName<T>) => string): string {
	if (typeof timeZone === 'string') {
		if (!timeZone.trim()) {
			throw new TypeError(`tableHelper.${method}(): the time zone is empty`);
		}

		return sqlString(toPostgresZone(timeZone));
	}

	if ('sql' in timeZone) {
		return timeZone.sql;
	}

	const column = toColumn(timeZone.column);

	return timeZone.fallback === undefined
		? column
		: `COALESCE(${column}, ${sqlString(toPostgresZone(timeZone.fallback))})`;
}

const ISO_OFFSET = /^([+-])(\d{2}):?(\d{2})?$/;

/**
 * PostgreSQL reads `'+02:00'` as a POSIX zone, whose offsets count west: UTC−2. An ISO 8601 offset is
 * written as the POSIX zone of the same offset, `'<+0200>-02:00'`, so `'+02:00'` is UTC+2 as everywhere else.
 */
function toPostgresZone(timeZone: string): string {
	const offset = ISO_OFFSET.exec(timeZone.trim());

	if (offset === null) {
		return timeZone;
	}

	const [, sign, hours, minutes = '00'] = offset;

	return `<${sign}${hours}${minutes}>${sign === '+' ? '-' : '+'}${hours}:${minutes}`;
}

/** The JSON functions of a database: PostgreSQL's unless the driver is MySQL / MariaDB or SQLite. */
function jsonFunctions(driver: DatabaseType | undefined, jsonb: boolean | undefined) {
	const mysql = isMysqlLikeDriver(driver);

	if (jsonb && (mysql || isSqliteLikeDriver(driver))) {
		throw new TypeError(`tableHelper: jsonb is PostgreSQL's, the driver is "${driver}"`);
	}

	if (mysql) {
		return { mysql, object: 'JSON_OBJECT', agg: 'JSON_ARRAYAGG', emptyArray: 'JSON_ARRAY()' };
	}

	if (isSqliteLikeDriver(driver)) {
		return { mysql, object: 'json_object', agg: 'json_group_array', emptyArray: 'json_array()' };
	}

	// PostgreSQL's when no driver is given; SQL Server, Oracle and the rest have functions of their own
	if (driver !== undefined && !isPostgresLikeDriver(driver)) {
		throw new TypeError(`tableHelper: the JSON functions are PostgreSQL's, MySQL / MariaDB's and SQLite's, the driver is "${driver}"`);
	}

	const type = jsonb ? 'jsonb' : 'json';

	// CAST, not `::json`: TypeORM would read `:json` as a parameter
	return { mysql, object: `${type}_build_object`, agg: `${type}_agg`, emptyArray: `CAST('[]' AS ${type})` };
}

// MySQL reads a backslash in a string as an escape (unless NO_BACKSLASH_ESCAPES): `\'` would end the literal
const sqlString = (value: string, driver?: DatabaseType) =>
	`'${(isMysqlLikeDriver(driver) ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''")}'`;

export type JsonFieldRest<V> = [NonNullable<V>] extends [Record<string, unknown>]
	? JsonFieldTuple<NonNullable<V>>
	: string[];

const createTableHelper = <T extends ObjectLiteral>(
	alias?: string,
	options: TableHelperOptions = {},
	databaseNames?: ReadonlyMap<string, string>,
) => ({
	alias,
	/**
	 * Returns a quoted SQL column identifier, e.g. `"alias"."column"`. The column is always quoted as one
	 * identifier, so names with other characters work too: `"user"."first-name"`.
	 */
	column(columnName: keyof T, alias?: string) {
		const { useQuotes = true, driver } = options;

		const tableAlias = alias ?? this.alias;
		const column = databaseNames?.get(String(columnName)) ?? String(columnName);

		if (!useQuotes) {
			return [tableAlias, column].filter(Boolean).join('.');
		}

		return [tableAlias ? quoteIdentifierPath(tableAlias, driver) : undefined, quoteIdentifier(column, driver)]
			.filter(Boolean)
			.join('.');
	},
	/** Returns a column identifier optionally followed by an expression, e.g. `"user"."id" = :id`. */
	where(columnName: keyof T, expression?: string) {
		const column = this.column(columnName);
		return [column, expression].filter(Boolean).join(' ');
	},
	/** Returns an unquoted join path, e.g. `user.images`. Needs the helper's alias, or `alias`. */
	join(relation: keyof T, alias?: string) {
		const tableAlias = alias ?? this.alias;

		if (!tableAlias) {
			throw new TypeError(
				`tableHelper().join('${String(relation)}') needs an alias: tableHelper('user').join('${String(relation)}')`
			);
		}

		return `${tableAlias}.${String(relation)}`;
	},
	/**
	 * Returns a column with a JOIN ON expression, e.g. `"user"."id" = "images"."userId"`.
	 * The expression is inserted as is: build its columns with another `tableHelper`
	 * (`t.joinOn('id', '= ' + images.column('userId'))`), since unquoted camelCase names
	 * like `images.userId` are folded to lowercase by PostgreSQL unless TypeORM rewrites them.
	 */
	joinOn(thisColumn: keyof T, expression: string) {
		return this.where(thisColumn, expression);
	},
	/** Returns `"alias"."column" IS NULL`. */
	isNull(columnName: keyof T) {
		return this.where(columnName, 'IS NULL');
	},
	/** Returns `"alias"."column" IS NOT NULL`. */
	isNotNull(columnName: keyof T) {
		return this.where(columnName, 'IS NOT NULL');
	},
	/**
	 * Returns `CAST(COUNT("alias"."column") AS integer)`: the rows where the column isn't `NULL`. With the `driver` option
	 * MySQL casts `AS SIGNED`, a `BIGINT`, which its TypeORM driver returns as a string by default.
	 * Without a column it is `COUNT(*)`, all the rows of the result, in every database. To count the rows
	 * of a table joined with LEFT JOIN, count one of its non-null columns: `images.count('id')`.
	 * @example
	 * t.count('email', { distinct: true })              // CAST(COUNT(DISTINCT "user"."email") AS integer)
	 * t.count(undefined, { filter: t.where('status', "= 'active'") })
	 * // CAST(COUNT(CASE WHEN "user"."status" = 'active' THEN 1 END) AS integer)
	 * t.count(undefined, { filter: t.where('status', "= 'active'"), syntax: 'filter' })
	 * // CAST(COUNT(*) FILTER (WHERE "user"."status" = 'active') AS integer)
	 */
	count(columnName?: keyof T, countOptions: TableHelperCountOptions = {}) {
		if (typeof countOptions !== 'object' || countOptions === null) {
			throw new TypeError(
				'tableHelper.count(): the second argument is an options object, e.g. { distinct: true } or { filter: "…" }'
			);
		}

		const { distinct = false, filter, syntax = 'case' } = countOptions;
		const column = columnName ? this.column(columnName) : undefined;

		if (distinct && !column) {
			throw new TypeError("tableHelper.count({ distinct: true }) needs a column, e.g. count('email', { distinct: true })");
		}

		// `COUNT(*)`, not `COUNT("alias".*)`, which only PostgreSQL accepts;
		// a CASE can't return `*`: without a column, it counts 1 per matching row
		const { argument, suffix } = filtered('count', column ?? (filter && syntax === 'case' ? '1' : '*'), filter, syntax, options.driver);

		// `CAST(… AS integer)` is a syntax error on MySQL
		return this.cast(
			`COUNT(${distinct ? 'DISTINCT ' : ''}${argument})${suffix}`,
			isMysqlLikeDriver(options.driver) ? 'SIGNED' : 'integer'
		);
	},
	/**
	 * Returns `COALESCE(SUM("alias"."column"), 0)`: 0, not `NULL`, for a group without rows or a LEFT JOIN
	 * without a match. Only a column whose property is a number. PostgreSQL sums integers into a `bigint`
	 * and MySQL into a `DECIMAL`, which the drivers return as strings.
	 * @example
	 * t.sum('amountCents', { filter: t.where('status', "= 'paid'") })
	 * // COALESCE(SUM(CASE WHEN "order"."status" = 'paid' THEN "order"."amountCents" END), 0)
	 */
	sum(columnName: NumericColumnName<T>, sumOptions: TableHelperSumOptions = {}) {
		const { argument, suffix } = filtered('sum', this.column(columnName), sumOptions.filter, sumOptions.syntax, options.driver);

		return `COALESCE(SUM(${argument})${suffix}, 0)`;
	},
	/**
	 * Returns the PostgreSQL array of a column over the rows of a group, `{}` for a group without rows.
	 * Other databases have no arrays and throw a `TypeError`: use `jsonAgg` there.
	 * @example
	 * images.arrayAgg('id', { distinct: true, orderBy: ['id', 'DESC'], filter: images.isNotNull('id') })
	 * // COALESCE(array_agg(DISTINCT "image"."id" ORDER BY "image"."id" DESC) FILTER (WHERE "image"."id" IS NOT NULL), '{}')
	 */
	arrayAgg(columnName: ColumnName<T>, aggOptions: TableHelperArrayAggOptions<T> = {}) {
		const { distinct = false, orderBy, filter } = aggOptions;

		if (options.driver !== undefined && !isPostgresLikeDriver(options.driver)) {
			throw new TypeError(`tableHelper.arrayAgg(): arrays are PostgreSQL's, the driver is "${options.driver}": use jsonAgg`);
		}

		const order = orderBy ? aggregateOrder('arrayAgg', orderBy, (column) => this.column(column)) : undefined;

		// PostgreSQL: "in an aggregate with DISTINCT, ORDER BY expressions must appear in argument list"
		if (distinct && order && order.column !== columnName) {
			throw new TypeError(
				`tableHelper.arrayAgg(): with distinct, the array can only be ordered by "${columnName}", got "${order.column}"`
			);
		}

		const aggregate = `array_agg(${distinct ? 'DISTINCT ' : ''}${this.column(columnName)}${order?.sql ?? ''})`;

		// the untyped '{}' takes the type of the array
		return `COALESCE(${aggregate}${filter ? ` FILTER (WHERE ${filter})` : ''}, '{}')`;
	},
	/**
	 * Returns a JSON object of columns, keyed by the column names or by the keys of a `{ key: column }` map.
	 * Every column is checked against the entity type.
	 * @example
	 * t.jsonBuildObject(['id', 'url'])              // json_build_object('id', "image"."id", 'url', "image"."url")
	 * t.jsonBuildObject({ imageId: 'id', src: 'url' }) // json_build_object('imageId', "image"."id", 'src', "image"."url")
	 * // MySQL: JSON_OBJECT(…), SQLite: json_object(…); { jsonb: true }: jsonb_build_object(…)
	 */
	jsonBuildObject(
		columns: readonly ColumnName<T>[] | Readonly<Record<string, ColumnName<T>>>,
		jsonOptions: TableHelperJsonOptions = {}
	) {
		const entries: [string, ColumnName<T>][] = Array.isArray(columns)
			? (columns as readonly ColumnName<T>[]).map((column) => [column, column])
			: Object.entries(columns as Readonly<Record<string, ColumnName<T>>>);

		if (!entries.length) {
			throw new TypeError('tableHelper.jsonBuildObject() needs at least one column');
		}

		const pairs = entries.map(([key, column]) => `${sqlString(key, options.driver)}, ${this.column(column)}`);

		return `${jsonFunctions(options.driver, jsonOptions.jsonb).object}(${pairs.join(', ')})`;
	},
	/**
	 * Returns the JSON array of an expression over the rows of a group, `[]` for a group without rows
	 * (the aggregate alone gives `NULL` there). Use it with GROUP BY, or in a subquery.
	 * @example
	 * images.jsonAgg(images.jsonBuildObject(['id', 'url']), { orderBy: ['id', 'DESC'], filter: images.isNotNull('id') })
	 * // COALESCE(json_agg(json_build_object(…) ORDER BY "image"."id" DESC) FILTER (WHERE "image"."id" IS NOT NULL), CAST('[]' AS json))
	 * // MySQL: COALESCE(JSON_ARRAYAGG(…), JSON_ARRAY()), without ORDER BY and FILTER; SQLite: json_group_array(…)
	 */
	jsonAgg(expression: string, aggOptions: TableHelperJsonAggOptions<T> = {}) {
		const { orderBy, filter, jsonb } = aggOptions;
		const json = jsonFunctions(options.driver, jsonb);

		if (json.mysql && (orderBy || filter)) {
			throw new TypeError("tableHelper.jsonAgg(): MySQL's JSON_ARRAYAGG takes no ORDER BY and no FILTER");
		}

		const order = orderBy ? aggregateOrder('jsonAgg', orderBy, (column) => this.column(column)).sql : '';
		const aggregate = `${json.agg}(${expression}${order})${filter ? ` FILTER (WHERE ${filter})` : ''}`;

		return `COALESCE(${aggregate}, ${json.emptyArray})`;
	},
	/** Returns `CAST(expression AS type)`. */
	cast(expression: string, type: string) {
		return `CAST(${expression} AS ${type})`;
	},
	/**
	 * Returns a full JSONB column access expression.
	 * @example
	 * t.jsonColumn('metadata', '->>', 'role')             // → "user"."metadata" ->> 'role'
	 * t.jsonColumn('metadata', '->>', 'settings', 'theme') // → "user"."metadata" -> 'settings' ->> 'theme'
	 */
	jsonColumn<K extends keyof T>(
		columnName: K,
		jsonOperator: '->>' | '->',
		...fieldNames: JsonFieldRest<T[K]>
	) {
		const column = this.column(columnName);
		const path = buildJsonPath(fieldNames, jsonOperator);
		return `${column} ${path}`;
	},
	/**
	 * Returns only the JSONB operator fragment (without the column).
	 * Useful inside `whereTyped` conditions strings.
	 * @example
	 * t.jsonPath('metadata', '->>', 'role')              // → ->> 'role'
	 * t.jsonPath('metadata', '->>', 'settings', 'theme') // → -> 'settings' ->> 'theme'
	 *
	 * // Combined with whereTyped:
	 * qb.whereTyped(u => u.metadata, `${t.jsonPath('metadata', '->>', 'role')} =`, 'admin')
	 */
	jsonPath<K extends keyof T>(
		_columnName: K,
		jsonOperator: '->>' | '->',
		...fieldNames: JsonFieldRest<T[K]>
	) {
		return buildJsonPath(fieldNames, jsonOperator);
	},
	/**
	 * Returns `(expression AT TIME ZONE zone)` (PostgreSQL). A `timestamptz` gives the wall-clock `timestamp`
	 * in that zone; a `timestamp` is read as wall-clock time there and gives a `timestamptz`.
	 * A zone name is written as an escaped literal, so it is safe to take from a request.
	 * @example
	 * t.atTimeZone('paidAt', 'Europe/Kyiv')                              // ("order"."paidAt" AT TIME ZONE 'Europe/Kyiv')
	 * t.atTimeZone('startsAt', { column: 'timezone', fallback: 'UTC' }) // ("order"."startsAt" AT TIME ZONE COALESCE("order"."timezone", 'UTC'))
	 */
	atTimeZone(value: TableHelperExpression<T>, timeZone: TableHelperTimeZone<T>) {
		assertPostgres('atTimeZone', options.driver);

		const toColumn = (column: ColumnName<T>) => this.column(column);

		return `(${toExpression(value, toColumn)} AT TIME ZONE ${toTimeZone('atTimeZone', timeZone, toColumn)})`;
	},
	/**
	 * Returns `date_trunc('unit', expression)` (PostgreSQL). With a time zone it is the three-argument form
	 * (PostgreSQL 12+): a `timestamptz` is truncated at the boundaries of that zone, e.g. its local midnight
	 * for `'day'`, and the result is a `timestamptz` again.
	 * @example
	 * t.dateTrunc('day', 'paidAt')                // date_trunc('day', "order"."paidAt")
	 * t.dateTrunc('day', 'paidAt', 'Europe/Kyiv') // date_trunc('day', "order"."paidAt", 'Europe/Kyiv')
	 */
	dateTrunc(unit: DateTruncUnit, value: TableHelperExpression<T>, timeZone?: TableHelperTimeZone<T>) {
		assertPostgres('dateTrunc', options.driver);

		// the unit goes into the SQL as is
		if (!DATE_TRUNC_UNITS.includes(unit)) {
			throw new TypeError(`tableHelper.dateTrunc(): the unit is one of ${DATE_TRUNC_UNITS.join(', ')}, got "${String(unit)}"`);
		}

		const toColumn = (column: ColumnName<T>) => this.column(column);
		const zone = timeZone === undefined ? '' : `, ${toTimeZone('dateTrunc', timeZone, toColumn)}`;

		return `date_trunc('${unit}', ${toExpression(value, toColumn)}${zone})`;
	}
});

type TableHelperMemberName = keyof ReturnType<typeof createTableHelper>;

/**
 * The helper `tableHelper` returns: its methods, and each column of the table as a read-only property,
 * `t.email` for `t.column('email')`. A column named like a member (`alias`, `count`, …) is the member there.
 */
export type TableHelper<T extends ObjectLiteral> = ReturnType<typeof createTableHelper<T>> & {
	readonly [K in Exclude<ColumnName<T>, TableHelperMemberName>]: string;
};

// keys that JavaScript, Node and test tools read on any object (await, JSON.stringify, util.inspect, Jest): they
// must stay undefined, as must symbols. The members of Object.prototype are in the target already
const PROTOCOL_KEYS: ReadonlySet<string> = new Set(['then', 'toJSON', 'inspect', 'asymmetricMatch', '$$typeof', 'nodeType']);

const columnAccess: ProxyHandler<{ column(columnName: string): string }> = {
	get(target, key, receiver) {
		if (typeof key === 'symbol' || key in target || PROTOCOL_KEYS.has(key)) {
			return Reflect.get(target, key, receiver);
		}

		return target.column(key);
	},
};

/** An entity class, abstract ones included. */
export type EntityClass<T> = abstract new (...args: never[]) => T;

const databaseNamesByEntity = new WeakMap<object, ReadonlyMap<string, string>>();

// The names set with `@Column({ name })` on the class or a parent, the nearest declaration winning. Every other
// column keeps its property name, as under TypeORM's default naming strategy. Columns of embedded entities are not read
const databaseColumnNames = (entity: EntityClass<ObjectLiteral>): ReadonlyMap<string, string> => {
	const cached = databaseNamesByEntity.get(entity);

	if (cached) {
		return cached;
	}

	const lineage: unknown[] = [];

	for (let target: unknown = entity; typeof target === 'function' && target !== Function.prototype; target = Object.getPrototypeOf(target)) {
		lineage.push(target);
	}

	const names = new Map<string, string>();
	const depths = new Map<string, number>();

	for (const { target, propertyName, options } of getMetadataArgsStorage().columns) {
		const depth = lineage.indexOf(target);

		if (depth !== -1 && options.name && depth < (depths.get(propertyName) ?? Infinity)) {
			names.set(propertyName, options.name);
			depths.set(propertyName, depth);
		}
	}

	databaseNamesByEntity.set(entity, names);

	return names;
};

/**
 * Creates a type-safe SQL helper for building column references, WHERE expressions,
 * JOIN clauses, and JSONB accessors for a given entity type.
 *
 * Given the entity class, it takes property names and writes the column names the entity maps them to:
 * `tableHelper(UserEntity, 'user').adminEmail` is `"user"."email"` for `@Column({ name: 'email' }) adminEmail`.
 *
 * @example
 * const t = tableHelper<UserEntity>('user');
 * t.column('email')              // → "user"."email"
 * t.email                        // → "user"."email", the same
 * t.where('id', '= :id')        // → "user"."id" = :id
 * t.jsonColumn('metadata', '->>', 'role')  // → "user"."metadata" ->> 'role'
 */
export function tableHelper<T extends ObjectLiteral>(entity: EntityClass<T>, alias?: string, options?: TableHelperOptions): TableHelper<T>;
export function tableHelper<T extends ObjectLiteral>(alias?: string, options?: TableHelperOptions): TableHelper<T>;
export function tableHelper<T extends ObjectLiteral>(
	entityOrAlias?: EntityClass<T> | string,
	aliasOrOptions?: string | TableHelperOptions,
	entityOptions?: TableHelperOptions,
): TableHelper<T> {
	if (entityOrAlias === undefined && typeof aliasOrOptions === 'string') {
		throw new TypeError(
			`tableHelper(entity, '${aliasOrOptions}'): the entity class is undefined, as a circular import leaves it at module load. Create the helper where it is used`
		);
	}

	const helper = typeof entityOrAlias === 'function'
		? createTableHelper<T>(aliasOrOptions as string | undefined, entityOptions, databaseColumnNames(entityOrAlias))
		: createTableHelper<T>(entityOrAlias, aliasOrOptions as TableHelperOptions | undefined);

	return new Proxy(helper, columnAccess) as TableHelper<T>;
}
