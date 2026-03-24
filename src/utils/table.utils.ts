import { ObjectLiteral } from "typeorm";
import { stringToSQLIdentifier } from './sql.utils';

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

export type JsonFieldRest<V> = [NonNullable<V>] extends [Record<string, unknown>]
	? JsonFieldTuple<NonNullable<V>>
	: string[];

function buildJsonPath(fieldNames: string[], jsonOperator: '->>' | '->') {
	let result = '';
	for (let i = 0; i < fieldNames.length; i++) {
		const op = i === fieldNames.length - 1 ? jsonOperator : '->';
		result += `${result ? ' ' : ''}${op} '${fieldNames[i]}'`;
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
	/** Returns a quoted SQL column identifier, e.g. `"alias"."column"`. */
	column(columnName: keyof T, alias?: string) {
		const { useQuotes = true } = options;

		const ids = [alias ?? this.alias, columnName].filter(Boolean); // [table, column]

		// ["table", "column"] -> "table.column"
		const id = ids.join('.');

		if (useQuotes) {
			return stringToSQLIdentifier(id);
		}

		return id;
	},
	/** Returns a column identifier optionally followed by an expression, e.g. `"user"."id" = :id`. */
	where(columnName: keyof T, expression?: string) {
		const column = this.column(columnName);
		return [column, expression].filter(Boolean).join(' ');
	},
	/** Returns an unquoted join path, e.g. `user.images`. */
	join(relation: keyof T) {
		return `${this.alias}.${String(relation)}`;
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
	/** Returns `CAST(COUNT("alias"."column") AS integer)`. Counts all rows if no column given. */
	count(columnName?: keyof T, countExpression?: string) {
		const target = columnName ? this.column(columnName) : `${stringToSQLIdentifier(this.alias ?? '')}.*`;
		const countArgs = [target, countExpression].filter(Boolean).join(' ');
		return this.cast(`COUNT(${countArgs})`, 'integer');
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
