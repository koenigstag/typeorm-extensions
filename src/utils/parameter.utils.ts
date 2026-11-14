import type { ObjectLiteral } from 'typeorm';
import { createUniqueParameterName } from './sql.utils';

// TypeORM's placeholder syntax, `:name` and `:...name`, as its drivers match it
const PARAMETER_PLACEHOLDER = /:(\.\.\.)?([A-Za-z0-9_.]+)/g;

/** The parameter names an SQL fragment refers to, as TypeORM reads its placeholders. */
export function getPlaceholderNames(sql: string): string[] {
  // a regex of its own: a global regex keeps its position between exec calls
  const placeholder = new RegExp(PARAMETER_PLACEHOLDER.source, 'g');
  const names: string[] = [];

  for (let match = placeholder.exec(sql); match !== null; match = placeholder.exec(sql)) {
    names.push(match[2]);
  }

  return names;
}

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

/**
 * The SQL of a query, without the parentheses a `subQuery()` builder writes around itself, and its parameters, both
 * renamed unique (see `withUniqueParameterNames`).
 */
export function toSubQuerySql(query: { getQuery(): string; getParameters(): ObjectLiteral }): [string, ObjectLiteral] {
  const sql = query.getQuery();
  const wrapped = 'expressionMap' in query && (query as { expressionMap: { subQuery?: boolean } }).expressionMap.subQuery;

  return withUniqueParameterNames(wrapped ? sql.slice(1, -1) : sql, query.getParameters());
}
