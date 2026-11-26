import { QueryBuilder } from 'typeorm';
import type { ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
import { getDriverType } from './sql.utils';
import { scanUnboundParameters, SqlDialect, toSqlDialect, UnboundParameter } from './unbound-parameter.utils';

const toPlaceholder = ({ name, spread }: UnboundParameter): string => `:${spread ? '...' : ''}${name}`;

/** The SQL of a query has a `:name` parameter without a value; see `enableUnboundParameterGuard`. */
export class UnboundParameterError extends Error {
  /** The SQL of the query, as the driver gets it. */
  readonly sql: string;
  /** Each parameter without a value, in the order of the SQL. */
  readonly parameters: UnboundParameter[];

  constructor(sql: string, parameters: UnboundParameter[]) {
    const [first] = parameters;
    const found = parameters.map((parameter) => `${toPlaceholder(parameter)} in ${parameter.snippet}`).join('; ');

    super(
      `Query parameter without a value: ${found}. ` +
        `TypeORM leaves a parameter it has no value for in the SQL as written, and the database rejects the query. ` +
        (first
          ? `Pass the value with the condition that names it, or call setParameter('${first.name}', ${
              first.spread ? '[...values]' : 'value'
            })`
          : '')
    );

    this.name = 'UnboundParameterError';
    this.sql = sql;
    this.parameters = parameters;
  }
}

export type UnboundParameterGuardOptions =
  | {
      /** `'throw'` (the default): the query rejects with an `UnboundParameterError` before it runs. */
      mode?: 'throw';
    }
  | {
      /** `'warn'`: the query runs, and the error is passed to `onViolation`. */
      mode: 'warn';
      /** Reports the error the query would throw in `'throw'` mode; `console.warn` by default. */
      onViolation?: (violation: UnboundParameterError) => void;
    };

type GuardState = {
  mode: 'throw' | 'warn';
  onViolation: (violation: UnboundParameterError) => void;
};

let guard: GuardState | undefined;
let installed = false;
let lastScan: { sql: string; dialect: SqlDialect; parameters: UnboundParameter[] } | undefined;

const reportViolation = (violation: UnboundParameterError): void => console.warn(violation);

function checkQuery(queryBuilder: QueryBuilder<ObjectLiteral>, sql: string, state: GuardState): void {
  const driver = getDriverType(queryBuilder as unknown as WhereExpressionBuilder);

  if (typeof sql !== 'string' || driver === 'mongodb') {
    return;
  }

  const dialect = toSqlDialect(driver);

  // the same SQL again, as a query run in a loop: one scan
  const parameters =
    lastScan && lastScan.sql === sql && lastScan.dialect === dialect
      ? lastScan.parameters
      : scanUnboundParameters(sql, dialect);

  lastScan = { sql, dialect, parameters };

  if (parameters.length === 0) {
    return;
  }

  const violation = new UnboundParameterError(sql, parameters);

  if (state.mode === 'throw') {
    throw violation;
  }

  state.onViolation(violation);
}

// every query of every builder gets its SQL here, with the parameters filled in, before it runs: getMany, getRawMany,
// getOne, getCount, stream, execute; getSql() too. getQuery() isn't checked: its parameters aren't filled in yet
function installGuard(): void {
  if (installed) {
    return;
  }

  installed = true;

  const getQueryAndParameters = QueryBuilder.prototype.getQueryAndParameters;

  QueryBuilder.prototype.getQueryAndParameters = function (this: QueryBuilder<ObjectLiteral>) {
    const queryAndParameters = getQueryAndParameters.call(this);

    if (guard) {
      checkQuery(this, queryAndParameters[0], guard);
    }

    return queryAndParameters;
  };
}

/**
 * Checks the SQL of every query builder for a `:name` or `:...name` parameter without a value
 * (`findUnboundParameters`) before the query runs. TypeORM leaves such a parameter in the SQL as written, and the
 * database rejects the query with a syntax error that doesn't name it.
 *
 * Off by default. A second call replaces the options. MongoDB isn't checked.
 */
export function enableUnboundParameterGuard(options: UnboundParameterGuardOptions = {}): void {
  const mode = options.mode ?? 'throw';

  if (mode !== 'throw' && mode !== 'warn') {
    throw new TypeError(`Invalid mode ${JSON.stringify(mode)} of the unbound parameter guard: 'throw' or 'warn'`);
  }

  guard = {
    mode,
    onViolation: (options.mode === 'warn' && options.onViolation) || reportViolation,
  };

  installGuard();
}

/** Turns the check of `enableUnboundParameterGuard` off. */
export function disableUnboundParameterGuard(): void {
  guard = undefined;
  lastScan = undefined;
}
