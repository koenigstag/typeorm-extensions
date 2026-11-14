import { ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
import type { KeyProxyCallback } from '../types/modules/proxy-callback.types';
import type { JsonPathSqlOptions } from './json-path.utils';
import { getTypedSingleColumnKey } from './query-builder.utils';

/**
 * Calls the untyped where `method` with the single column a typed callback picks, followed by `args`, as the typed
 * where methods that only add the column to their untyped counterpart do. A callback that isn't a function, from
 * untyped code, leaves the builder as it is.
 */
export function attachTypedColumnWhere<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder,
  Args extends unknown[] = unknown[]
>(
  builder: QB,
  method: string,
  where: KeyProxyCallback<Type>,
  jsonOptions: JsonPathSqlOptions | undefined,
  ...args: Args
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`, jsonOptions);

  return (builder as unknown as Record<string, (field: string, ...rest: Args) => QB>)[method](key, ...args);
}
