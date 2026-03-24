import { ObjectLiteral } from "typeorm";
import { stringToSQLIdentifier } from './sql.utils';

export type TableHelperOptions = {
	useQuotes?: boolean;
};

export const tableHelper = <T extends ObjectLiteral>(alias?: string, options: TableHelperOptions = {}) => ({
	alias,
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
	where(columnName: keyof T, expression?: string) {
		const column = this.column(columnName);
		return [column, expression].filter(Boolean).join(' ');
	},
	join(relation: keyof T) {
		return `${this.alias}.${String(relation)}`;
	},
	joinOn(thisColumn: keyof T, expression: string) {
		return this.where(thisColumn, expression);
	},
	isNull(columnName: keyof T) {
		return this.where(columnName, 'IS NULL');
	},
	isNotNull(columnName: keyof T) {
		return this.where(columnName, 'IS NOT NULL');
	},
	count(columnName?: keyof T, countExpression?: string) {
		const target = columnName ? this.column(columnName) : `${stringToSQLIdentifier(this.alias ?? '')}.*`;
		const countArgs = [target, countExpression].filter(Boolean).join(' ');
		return this.cast(`COUNT(${countArgs})`, 'integer');
	},
	cast(expression: string, type: string) {
		return `CAST(${expression} AS ${type})`;
	},
	jsonField(columnName: keyof T, fieldName: string, jsonOperator: string = '->>') {
		const column = this.column(columnName);
		return `${column} ${jsonOperator} '${fieldName}'`;
	}
});
