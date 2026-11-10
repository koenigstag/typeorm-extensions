import { DatabaseType, ObjectLiteral } from "typeorm";
import { isMysqlLikeDriver, isSqliteLikeDriver, quoteIdentifier, quoteIdentifierPath } from './sql.utils';
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
function filtered(method: string, argument: string, filter: string | undefined, syntax: unknown = 'case') {
	if (syntax !== 'case' && syntax !== 'filter') {
		throw new TypeError(`tableHelper.${method}(): syntax is 'case' or 'filter', got "${String(syntax)}"`);
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

	const type = jsonb ? 'jsonb' : 'json';

	// CAST, not `::json`: TypeORM would read `:json` as a parameter
	return { mysql, object: `${type}_build_object`, agg: `${type}_agg`, emptyArray: `CAST('[]' AS ${type})` };
}

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

export type JsonFieldRest<V> = [NonNullable<V>] extends [Record<string, unknown>]
	? JsonFieldTuple<NonNullable<V>>
	: string[];

/**
 * Creates a type-safe SQL helper for building column references, WHERE expressions,
 * JOIN clauses, and JSONB accessors for a given entity type.
 *
 * @example
 * const t = tableHelper<UserEntity>('user');
 * t.column('email')              // → "user"."email"
 * t.where('id', '= :id')        // → "user"."id" = :id
 * t.jsonColumn('metadata', '->>', 'role')  // → "user"."metadata" ->> 'role'
 */
export const tableHelper = <T extends ObjectLiteral>(alias?: string, options: TableHelperOptions = {}) => ({
	alias,
	/**
	 * Returns a quoted SQL column identifier, e.g. `"alias"."column"`. The column is always quoted as one
	 * identifier, so names with other characters work too: `"user"."first-name"`.
	 */
	column(columnName: keyof T, alias?: string) {
		const { useQuotes = true, driver } = options;

		const tableAlias = alias ?? this.alias;
		const column = String(columnName);

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
		const { argument, suffix } = filtered('count', column ?? (filter && syntax === 'case' ? '1' : '*'), filter, syntax);

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
		const { argument, suffix } = filtered('sum', this.column(columnName), sumOptions.filter, sumOptions.syntax);

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

		if (isMysqlLikeDriver(options.driver) || isSqliteLikeDriver(options.driver)) {
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

		const pairs = entries.map(([key, column]) => `${sqlString(key)}, ${this.column(column)}`);

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
	}
});
