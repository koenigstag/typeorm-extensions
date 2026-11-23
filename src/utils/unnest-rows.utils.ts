import type { ObjectLiteral } from 'typeorm';
import type { TableRow } from './table.utils';

/** The SQL of an array per column of a row, by the column's name. */
export type UnnestColumns<Row extends ObjectLiteral, Ordinality extends string> = {
  readonly [K in Exclude<keyof Row & string, Ordinality>]-?: string;
};

export type UnnestRowsOptions<Ordinality extends string> = {
  /** The column `WITH ORDINALITY` numbers the rows in, from 1. */
  ordinality: Ordinality;
};

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/**
 * `SELECT * FROM unnest(<array>, …) AS t("<column>", …)`: rows zipped from arrays, one array per column of the row
 * `table` reads, checked against it like `selectRow`. The body of a CTE; PostgreSQL only.
 */
export function unnestRows<Row extends ObjectLiteral, Ordinality extends keyof Row & string = never>(
  table: TableRow<Row>,
  arrays: UnnestColumns<Row, Ordinality>,
  options?: UnnestRowsOptions<Ordinality>
): string {
  const entries = Object.entries<string>(arrays);

  if (!entries.length) {
    throw new TypeError('unnestRows: the row has no columns');
  }

  const columns = entries.map(([column]) => column);
  const ordinality = options ? ' WITH ORDINALITY' : '';

  if (options) {
    columns.push(options.ordinality);
  }

  return `SELECT * FROM unnest(${entries.map(([, array]) => array).join(', ')})${ordinality} AS t(${columns.map(quote).join(', ')})`;
}
