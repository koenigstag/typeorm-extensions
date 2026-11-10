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
	orderBy?: ColumnName<T> | readonly [ColumnName<T>, 'ASC' | 'DESC'];
	/**
	 * Aggregates only the rows that match, e.g. `images.isNotNull('id')`: after a LEFT JOIN without a match
	 * the row has `NULL` columns, which would otherwise come out as `[{"id": null}]`. Not on MySQL.
	 */
	filter?: string;
};

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

// MySQL reads a backslash in a string as an escape (unless NO_BACKSLASH_ESCAPES): `\'` would end the literal
const sqlString = (value: string, driver?: DatabaseType) =>
	`'${(isMysqlLikeDriver(driver) ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''")}'`;

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
	 * Returns `CAST(COUNT("alias"."column") AS integer)`: the rows where the column isn't `NULL`.
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

		if (syntax !== 'case' && syntax !== 'filter') {
			throw new TypeError(`tableHelper.count(): syntax is 'case' or 'filter', got "${String(syntax)}"`);
		}

		const column = columnName ? this.column(columnName) : undefined;

		if (distinct && !column) {
			throw new TypeError("tableHelper.count({ distinct: true }) needs a column, e.g. count('email', { distinct: true })");
		}

		// `COUNT(*)`, not `COUNT("alias".*)`, which only PostgreSQL accepts;
		// a CASE can't return `*`: without a column, it counts 1 per matching row
		const counted = filter && syntax === 'case' ? `CASE WHEN ${filter} THEN ${column ?? '1'} END` : column ?? '*';

		let expression = `COUNT(${distinct ? 'DISTINCT ' : ''}${counted})`;

		if (filter && syntax === 'filter') {
			expression += ` FILTER (WHERE ${filter})`;
		}

		return this.cast(expression, 'integer');
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

		let order = '';

		if (orderBy) {
			const [column, direction] = typeof orderBy === 'string' ? [orderBy] : orderBy;

			if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC') {
				throw new TypeError(`tableHelper.jsonAgg(): the order is 'ASC' or 'DESC', got "${String(direction)}"`);
			}

			order = ` ORDER BY ${this.column(column)}${direction ? ` ${direction}` : ''}`;
		}

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
