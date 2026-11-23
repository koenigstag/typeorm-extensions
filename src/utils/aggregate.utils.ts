import type { DatabaseType } from 'typeorm';
import { isMysqlLikeDriver } from './sql.utils';

/**
 * The argument of an aggregate and the clause after it for a `filter` written with `syntax`:
 * `CASE WHEN filter THEN argument END`, or `argument` and ` FILTER (WHERE filter)`.
 */
export function filtered(
	method: string,
	argument: string,
	filter: string | undefined,
	syntax: unknown = 'case',
	driver?: DatabaseType
) {
	if (syntax !== 'case' && syntax !== 'filter') {
		throw new TypeError(`${method}(): syntax is 'case' or 'filter', got "${String(syntax)}"`);
	}

	if (filter && syntax === 'filter' && isMysqlLikeDriver(driver)) {
		throw new TypeError(`${method}(): MySQL / MariaDB have no FILTER (WHERE …), use syntax 'case'`);
	}

	if (!filter) {
		return { argument, suffix: '' };
	}

	return syntax === 'case'
		? { argument: `CASE WHEN ${filter} THEN ${argument} END`, suffix: '' }
		: { argument, suffix: ` FILTER (WHERE ${filter})` };
}

// MySQL reads a backslash in a string as an escape (unless NO_BACKSLASH_ESCAPES): `\'` would end the literal
export const sqlString = (value: string, driver?: DatabaseType) =>
	`'${(isMysqlLikeDriver(driver) ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''")}'`;
