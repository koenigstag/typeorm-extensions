import type { ObjectLiteral } from 'typeorm';
import { createUniqueParameterName } from './sql.utils';

// TypeORM's placeholder syntax, `:name` and `:...name`, as its drivers match it
const PARAMETER_PLACEHOLDER = /:(\.\.\.)?([A-Za-z0-9_.]+)/g;

/**
 * Renames the parameters of a subquery to unique names, in its SQL and in its parameters. A query
 * has one parameter namespace, so two subqueries with a `:status` each would otherwise both read
 * whichever value was set last. Placeholders that aren't keys of `parameters` stay as they are.
 */
export function withUniqueParameterNames(
  sql: string,
  parameters: ObjectLiteral
): [string, ObjectLiteral] {
  const names = new Map(
    Object.keys(parameters).map((name) => [name, createUniqueParameterName(name)])
  );

  const renamedSql = sql.replace(
    PARAMETER_PLACEHOLDER,
    (placeholder, spread: string | undefined, name: string) => {
      const unique = names.get(name);

      return unique ? `:${spread ?? ''}${unique}` : placeholder;
    }
  );

  const renamedParameters = Object.fromEntries(
    Object.entries(parameters).map(([name, value]) => [names.get(name), value])
  );

  return [renamedSql, renamedParameters];
}
