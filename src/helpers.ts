// Side-effect-free entry point: `typeorm-extensions/helpers`.
// Exports helpers (tableHelper, escapeLikePattern, the reserved qualifier and unbound parameter guards, strict order input, pagination math, @GeneratedColumn) only and patches nothing on import;
// importing the package root (`typeorm-extensions`) installs every QueryBuilder extension.
export * from './utils/table.utils';
export * from './decorators/generated-column.decorator';
export { escapeLikePattern } from './utils/search.utils';
export { EqualColumn, IsDistinctFrom, IsFalse, IsIn, IsTrue, Or } from './utils/find-operator.utils';
export { Sql } from './utils/sql-functions.utils';
export type {
  SqlAggregateOptions,
  SqlArrayAggOptions,
  SqlCaseBranch,
  SqlCaseOfBranch,
  SqlCaseOptions,
  SqlDatePart,
  SqlFunctions,
  SqlIntervalAmount,
  SqlIntervalUnit,
  SqlJsonKey,
  SqlOptions,
  SqlStringAggOptions,
  SqlTimeZone,
  SqlValue,
  SqlValueAggregateOptions,
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
export { findUnboundParameters } from './utils/unbound-parameter.utils';
export type { UnboundParameter } from './utils/unbound-parameter.utils';
export {
  disableUnboundParameterGuard,
  enableUnboundParameterGuard,
  UnboundParameterError,
} from './utils/unbound-parameter-guard.utils';
export type { UnboundParameterGuardOptions } from './utils/unbound-parameter-guard.utils';
export { disableStrictOrderInput, enableStrictOrderInput, InvalidOrderError } from './utils/order-input.utils';
export type { InvalidOrderPart } from './utils/order-input.utils';
export {
  getLimitAndOffset,
  getPaginationDefaults,
  normalizePageSize,
  PageOutOfRangeError,
  setPaginationDefaults,
} from './utils/pagination.utils';
export type { PageSizeOptions, PaginationDefaults, PaginationInput } from './utils/pagination.utils';
