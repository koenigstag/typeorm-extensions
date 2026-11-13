// Side-effect-free entry point: `typeorm-extensions/helpers`.
// Exports helpers (tableHelper, escapeLikePattern, the reserved qualifier guard, @GeneratedColumn) only and patches nothing on import;
// importing the package root (`typeorm-extensions`) installs every QueryBuilder extension.
export * from './utils/table.utils';
export * from './decorators/generated-column.decorator';
export { escapeLikePattern } from './utils/search.utils';
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
