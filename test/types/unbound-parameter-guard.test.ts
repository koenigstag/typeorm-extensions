import {
  disableUnboundParameterGuard,
  enableUnboundParameterGuard,
  findUnboundParameters,
  UnboundParameter,
  UnboundParameterError,
  UnboundParameterGuardOptions,
} from 'typeorm-extensions';

enableUnboundParameterGuard();
enableUnboundParameterGuard({ mode: 'throw' });
enableUnboundParameterGuard({
  mode: 'warn',
  onViolation: (violation) => {
    const sql: string = violation.sql;
    const parameters: UnboundParameter[] = violation.parameters;
    const error: Error = violation;

    return [sql, parameters, error];
  },
});
enableUnboundParameterGuard({ mode: 'warn' });
disableUnboundParameterGuard();

const options: UnboundParameterGuardOptions = { mode: 'warn' };
enableUnboundParameterGuard(options);

// @ts-expect-error onViolation reports in warn mode only
enableUnboundParameterGuard({ onViolation: () => undefined });
// @ts-expect-error onViolation reports in warn mode only
enableUnboundParameterGuard({ mode: 'throw', onViolation: () => undefined });
// @ts-expect-error not a mode
enableUnboundParameterGuard({ mode: 'error' });

const [found]: UnboundParameter[] = findUnboundParameters('"email" = :login', 'mysql');
const name: string = found.name;
const spread: boolean = found.spread;
// @ts-expect-error a database type
findUnboundParameters('"email" = :login', 'sqlserver');

const error: Error = new UnboundParameterError('"email" = :login', [found]);
