import { ObjectLiteral } from "typeorm";
import { quoteIdentifier, quoteIdentifierPath } from './sql.utils';

export type TableHelperOptions = {
	useQuotes?: boolean;
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

export type JsonFieldRest<V> = [NonNullable<V>] extends [Record<string, unknown>]
	? JsonFieldTuple<NonNullable<V>>
	: string[];

/** Wraps a JSON key in single quotes, doubling any quote inside it (standard SQL string literal). */
function toJsonKeyLiteral(fieldName: string) {
	return `'${String(fieldName).replace(/'/g, "''")}'`;
}

function buildJsonPath(fieldNames: string[], jsonOperator: '->>' | '->') {
	let result = '';
	for (let i = 0; i < fieldNames.length; i++) {
		const op = i === fieldNames.length - 1 ? jsonOperator : '->';
		result += `${result ? ' ' : ''}${op} ${toJsonKeyLiteral(fieldNames[i])}`;
	}
	return result;
}

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
		const { useQuotes = true } = options;

		const tableAlias = alias ?? this.alias;
		const column = String(columnName);

		if (!useQuotes) {
			return [tableAlias, column].filter(Boolean).join('.');
		}

		return [tableAlias ? quoteIdentifierPath(tableAlias) : undefined, quoteIdentifier(column)]
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
	/** Returns a column with a JOIN ON expression, e.g. `"user"."id" = image.userId`. */
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
