import { DatabaseType, getMetadataArgsStorage, ObjectLiteral } from "typeorm";
import {
	assertArrayType,
	isMysqlLikeDriver,
	quoteIdentifier,
	quoteIdentifierPath,
} from './sql.utils';
import { filtered } from './aggregate.utils';
import { Sql } from './sql-functions.utils';
import type { SqlJsonKey } from './sql-functions.utils';

export type { DateTruncUnit } from './time-zone.utils';

export type TableHelperOptions = {
	useQuotes?: boolean;
	/** The database the SQL is for: MySQL and MariaDB quote identifiers with backticks. Double quotes without it. */
	driver?: DatabaseType;
};

/** Values a JSON path stops at, as typed callbacks read them: dates and binary data are values, an array's items have no keys. */
type JsonPathLeaf = Date | ArrayBufferView | ArrayBuffer | readonly unknown[];

/** The keys of every member of a union: a JSON value of a union type may be any of them. */
type JsonKeys<T> = T extends JsonPathLeaf ? never : T extends object ? keyof T & string : never;

/** The value under `Key` in the members of `V` that have it. */
type JsonValueAt<V, Key> = V extends unknown ? (Key extends keyof V ? V[Key] : never) : never;

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

type ColumnName<T> = keyof T & string;

declare const jsonPathEnd: unique symbol;

/** The end of a path into a JSON column: a value with no keys of its own. */
export type JsonPathEnd = { readonly [jsonPathEnd]?: never };

/** A JSON value TypeScript knows nothing about: any key, at any depth. */
export type JsonPathAny = { readonly [key: string]: JsonPathAny };

type JsonObjectPart<V> = Exclude<Extract<NonNullable<V>, object>, Date | ArrayBufferView | ArrayBuffer>;

/** The keys a path may take below a JSON value: an object's keys (of any member of a union), an array's indexes. */
export type JsonPathNode<V> = 0 extends 1 & V
	? JsonPathAny
	: unknown extends V
		? JsonPathAny
		: [JsonObjectPart<V>] extends [never]
			? JsonPathEnd
			: [JsonObjectPart<V>] extends [readonly (infer E)[]]
				? { readonly [index: number]: JsonPathNode<E> }
				: [JsonKeys<JsonObjectPart<V>>] extends [never]
					? JsonPathAny
					: { readonly [K in JsonKeys<JsonObjectPart<V>>]-?: JsonPathNode<JsonValueAt<JsonObjectPart<V>, K>> };

/** The row `json` / `jsonText` read a path from: a column, then the keys of its JSON value. */
export type JsonPathRow<T> = { readonly [K in ColumnName<T>]-?: JsonPathNode<T[K]> };

const JSON_PATH = Symbol('jsonPath');
const ARRAY_INDEX = /^(0|[1-9]\d*)$/;

// the column and the keys a callback walks: (r) => r.metadata.settings.theme → ['metadata', 'settings', 'theme']
function readJsonPath(method: string, callback: unknown): [string, SqlJsonKey, ...SqlJsonKey[]] {
	if (typeof callback !== 'function') {
		throw new TypeError(`tableHelper.${method}() takes a callback, e.g. t.${method}((r) => r.metadata.role)`);
	}

	const step = (keys: readonly string[]): unknown =>
		new Proxy(
			{},
			{
				get: (_target, key) => {
					if (key === JSON_PATH) {
						return keys;
					}

					return typeof key === 'symbol' ? undefined : step([...keys, key]);
				},
			}
		);
	const result: unknown = callback(step([]));
	const keys = typeof result === 'object' && result !== null ? (result as { [JSON_PATH]?: unknown })[JSON_PATH] : undefined;

	if (!Array.isArray(keys)) {
		throw new TypeError(`tableHelper.${method}(): the callback returns a path, e.g. (r) => r.metadata.role`);
	}

	const [column, first, ...rest] = keys as string[];

	if (column === undefined || first === undefined) {
		throw new TypeError(
			`tableHelper.${method}(): the path needs a key inside the column, e.g. (r) => r.${column ?? 'metadata'}.role; the column itself is t.${column ?? 'metadata'}`
		);
	}

	const toKey = (key: string): SqlJsonKey => (ARRAY_INDEX.test(key) ? Number(key) : key);

	return [column, toKey(first), ...rest.map(toKey)];
}

/** The values of an IN / ANY condition, read only to tell an empty list: the caller binds them. */
type ValueList = readonly unknown[] | null | undefined;

const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const hasValues = (values: ValueList): boolean => {
	if (values === null || values === undefined) {
		return false;
	}

	if (!Array.isArray(values)) {
		throw new TypeError(`tableHelper: the values of an IN / ANY condition must be an array, got ${typeof values}`);
	}

	return values.length > 0;
};

// the name is written into the SQL as `:name`
const assertParamName = (param: string): string => {
	if (typeof param !== 'string' || !PARAM_NAME.test(param)) {
		throw new TypeError(`tableHelper: "${param}" is not a parameter name (letters, digits and _)`);
	}

	return param;
};

const arrayParameter = (param: string, arrayType?: string): string =>
	arrayType === undefined ? `:${assertParamName(param)}` : `CAST(:${assertParamName(param)} AS ${assertArrayType(arrayType)})`;

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
	 * Returns `"alias"."column" IN (:...param)`, or `FALSE` for no values, as `whereIsIn` writes it. The values
	 * are bound under `param` by the caller: `qb.andWhere(t.isIn('id', ids, 'ids'), { ids })`.
	 */
	isIn(columnName: keyof T, values: ValueList, param: string) {
		return hasValues(values) ? this.where(columnName, `IN (:...${assertParamName(param)})`) : 'FALSE';
	},
	/** Returns `"alias"."column" NOT IN (:...param)`, or `TRUE` for no values, as `whereIsNotIn` writes it. */
	isNotIn(columnName: keyof T, values: ValueList, param: string) {
		return hasValues(values) ? this.where(columnName, `NOT IN (:...${assertParamName(param)})`) : 'TRUE';
	},
	/**
	 * Returns `"alias"."column" = ANY(:param)`, or `FALSE` for no values, as `whereIsAny` writes it: the array is
	 * bound as one parameter, cast to `arrayType` when given (`'uuid[]'`). PostgreSQL.
	 */
	isAny(columnName: keyof T, values: ValueList, param: string, arrayType?: string) {
		return hasValues(values) ? this.where(columnName, `= ANY(${arrayParameter(param, arrayType)})`) : 'FALSE';
	},
	/** Returns `"alias"."column" <> ALL(:param)`, or `TRUE` for no values, as `whereIsNotAny` writes it. PostgreSQL. */
	isNotAny(columnName: keyof T, values: ValueList, param: string, arrayType?: string) {
		return hasValues(values) ? this.where(columnName, `<> ALL(${arrayParameter(param, arrayType)})`) : 'TRUE';
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
		const { argument, suffix } = filtered('tableHelper.count', column ?? (filter && syntax === 'case' ? '1' : '*'), filter, syntax, options.driver);

		// `CAST(… AS integer)` is a syntax error on MySQL
		return this.cast(
			`COUNT(${distinct ? 'DISTINCT ' : ''}${argument})${suffix}`,
			isMysqlLikeDriver(options.driver) ? 'SIGNED' : 'integer'
		);
	},
	/** Returns `CAST(expression AS type)`. */
	cast(expression: string, type: string) {
		return `CAST(${expression} AS ${type})`;
	},
	/**
	 * A value inside a JSON column as JSON, `->` key by key; a key of digits is an array index:
	 * `t.json((r) => r.metadata.settings)` → `("user"."metadata" -> 'settings')`. Keys are checked against
	 * the column's type. MySQL: `JSON_EXTRACT(…)`; SQLite 3.38+: `->` with a `$` path.
	 */
	json(path: (row: JsonPathRow<T>) => unknown): string {
		const [column, ...keys] = readJsonPath('json', path);
		const sql = options.driver === undefined ? Sql : Sql.for(options.driver);

		return sql.json(this.column(column as keyof T), ...keys);
	},
	/**
	 * A value inside a JSON column as text, `->` to the last key and `->>` on it:
	 * `t.jsonText((r) => r.metadata.settings.theme)` → `("user"."metadata" -> 'settings' ->> 'theme')`.
	 * A JSON `null` gives SQL NULL, where `json` gives a JSON `null` that `IS NOT NULL`.
	 */
	jsonText(path: (row: JsonPathRow<T>) => unknown): string {
		const [column, ...keys] = readJsonPath('jsonText', path);
		const sql = options.driver === undefined ? Sql : Sql.for(options.driver);

		return sql.jsonText(this.column(column as keyof T), ...keys);
	}
});

type TableHelperMemberName = keyof ReturnType<typeof createTableHelper>;

/**
 * The helper `tableHelper` returns: its methods, and each column of the table as a read-only property,
 * `t.email` for `t.column('email')`. A column named like a member (`alias`, `count`, …) is the member there.
 */
export type TableHelper<T extends ObjectLiteral> = ReturnType<typeof createTableHelper<T>> & {
	readonly [K in Exclude<ColumnName<T>, TableHelperMemberName>]: string;
} & TableRow<T>;

declare const tableRow: unique symbol;

/** The row a helper reads, type only: `selectRow(helper, …)` selects exactly its columns. */
export type TableRow<T extends ObjectLiteral> = { readonly [tableRow]?: T };

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
 * t.jsonText((u) => u.metadata.role) // → ("user"."metadata" ->> 'role')
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
