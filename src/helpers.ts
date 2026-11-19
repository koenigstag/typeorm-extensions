// Side-effect-free entry point: `typeorm-extensions/helpers`.
// Exports helpers (tableHelper, escapeLikePattern, the reserved qualifier guard, @GeneratedColumn) only and patches nothing on import;
// importing the package root (`typeorm-extensions`) installs every QueryBuilder extension.
export * from './utils/table.utils';
export * from './decorators/generated-column.decorator';
export { escapeLikePattern } from './utils/search.utils';
export { EqualColumn, IsDistinctFrom, IsFalse, IsIn, IsTrue } from './utils/find-operator.utils';
export { Sql } from './utils/sql-functions.utils';
export type {
  SqlAggregateOptions,
  SqlArrayAggOptions,
  SqlDatePart,
  SqlFunctions,
  SqlIntervalUnit,
  SqlJsonKey,
  SqlStringAggOptions,
  SqlTimeZone,
  SqlValue,
  SqlWindow,
} from './utils/sql-functions.utils';
export { selectExpression, SelectExpression } from './utils/select-expression.utils';
export { unnestRows } from './utils/unnest-rows.utils';
export type { UnnestColumns, UnnestRowsOptions } from './utils/unnest-rows.utils';
export {
  COCKROACHDB_RESERVED_KEY_WORDS,
  findBareReservedQualifiers,
  POSTGRES_RESERVED_KEY_WORDS,
} from './utils/reserved-qualifier.utils';
export type { ReservedQualifier } from './utils/reserved-qualifier.utils';
export {
  disableReservedQualifierGuard,
  enableReservedQualifierGuard,
  ReservedQualifierError,
} from './utils/reserved-qualifier-guard.utils';
export type { ReservedQualifierGuardOptions } from './utils/reserved-qualifier-guard.utils';
