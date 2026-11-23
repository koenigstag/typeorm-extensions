import type { ObjectLiteral } from 'typeorm';

/** What `queryReturning` resolves to: the same shape for every statement and every driver. */
export interface QueryReturningResult<Row = ObjectLiteral> {
  /** The rows the statement returned: those of a SELECT, or of a `RETURNING` clause. Empty when there are none. */
  records: Row[];
  /**
   * The number of rows the driver reports for the statement, `null` when it reports none.
   * SQLite reports none for a statement that returns rows, such as an UPDATE with `RETURNING`.
   */
  affected: number | null;
}
