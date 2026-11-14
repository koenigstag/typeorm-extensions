import { Column, ColumnOptions, ColumnType } from 'typeorm';

/** The options of `@Column`, without those that would let TypeORM write the column. */
export type GeneratedColumnOptions = Omit<ColumnOptions, 'insert' | 'update' | 'readonly'>;

/**
 * A column of the table that the database computes: `GENERATED ALWAYS AS (…) STORED`. TypeORM reads it like any
 * column and never writes it. `asExpression` alone doesn't stop TypeORM (0.3 and 1.x) from sending the column in
 * `save`, `insert` and `update`, which the database rejects for a generated column.
 *
 * Pass `asExpression` and `generatedType: 'STORED'` when TypeORM creates the schema (synchronize, generated
 * migrations); a column created by a hand-written migration needs neither.
 *
 * @example
 * \@GeneratedColumn({ type: 'integer', asExpression: 'price * quantity', generatedType: 'STORED' })
 * total: number;
 */
export function GeneratedColumn(options?: GeneratedColumnOptions): PropertyDecorator;
export function GeneratedColumn(type: ColumnType, options?: GeneratedColumnOptions): PropertyDecorator;
export function GeneratedColumn(
  typeOrOptions?: ColumnType | GeneratedColumnOptions,
  options: GeneratedColumnOptions = {}
): PropertyDecorator {
  const columnOptions: ColumnOptions & { readonly?: boolean } =
    typeof typeOrOptions === 'object'
      ? { ...typeOrOptions }
      : typeOrOptions === undefined
        ? { ...options }
        : { ...options, type: typeOrOptions };

  // TypeORM 0.3 applies `readonly` after `update`: `readonly: false` from an untyped caller would turn writes back on
  delete columnOptions.readonly;

  return Column({ ...columnOptions, insert: false, update: false });
}
