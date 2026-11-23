import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { TableRow } from '../../../utils/table.utils';
import { patchPrototype } from '../../../utils/prototype.utils';

/** The SQL of each column of a row, by the column's name. */
export type RowColumns<Row extends ObjectLiteral> = { readonly [K in keyof Row & string]-?: string };

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SelectQueryBuilder<Entity> {
    /**
     * Replaces the selection with `<sql> AS "<column>"` for each column of the row `table` reads: the select of
     * a CTE or subquery, checked against the helper that reads it. A missing, extra or misspelled column fails
     * type-check. Columns are selected in the order of `columns`.
     */
    selectRow<Row extends ObjectLiteral>(table: TableRow<Row>, columns: RowColumns<Row>): this;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    selectRow<Entity extends ObjectLiteral, Row extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      _table: TableRow<Row>,
      columns: RowColumns<Row>
    ) {
      const [first, ...rest] = Object.entries<string>(columns);

      if (!first) {
        throw new TypeError('selectRow: the row has no columns');
      }

      return rest.reduce((query, [column, sql]) => query.addSelect(sql, column), this.select(first[1], first[0]));
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
