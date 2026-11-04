import type { EntityMetadata, ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { KeyProxyCallback } from '../types/modules/proxy-callback.types';
import { getKeyHolder, KeyHolder } from './proxy-key.utils';

/**
 * Whether single-level typed keys are qualified with the main alias (`user.firstName`).
 *
 * UPDATE / DELETE builders turn alias prefixing off (`aliasNamePrefixingEnabled === false`)
 * and render `UPDATE "users" … WHERE …` without an alias, where `"UserEntity"."firstName"`
 * is invalid: their keys are just the column, `"firstName"`.
 */
function isAliasPrefixingEnabled(queryBuilder: QueryBuilder<ObjectLiteral>): boolean {
  return queryBuilder.expressionMap?.aliasNamePrefixingEnabled !== false;
}

/**
 * Main alias of the query for the single-level key `key`. A query created without an entity
 * (`dataSource.createQueryBuilder()`, `qb.subQuery()`) has none until `from()`: throw a
 * `TypeError` that says how to fix the call, instead of TypeORM's "Main alias is not set".
 */
function requireMainAliasName(queryBuilder: QueryBuilder<ObjectLiteral>, key: string): string {
  const mainAlias = queryBuilder.expressionMap?.mainAlias;

  if (!mainAlias) {
    throw new TypeError(
      `Typed key "${key}" has no alias and the query has no main alias yet. ` +
        `Call from() before this method, or address the column by its alias with an alias-keyed type: ` +
        `type Q = { someAlias: SomeEntity }; (q) => q.someAlias.${key}`
    );
  }

  return mainAlias.name;
}

/** Entity metadata of a query alias (the main alias when `aliasName` is undefined), if it has any. */
function getAliasMetadata(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  aliasName: string | undefined
): EntityMetadata | undefined {
  const expressionMap = queryBuilder.expressionMap;
  const alias =
    aliasName === undefined
      ? expressionMap?.mainAlias
      : expressionMap?.aliases.find((queryAlias) => queryAlias.name === aliasName);

  return alias?.hasMetadata ? alias.metadata : undefined;
}

/**
 * Database name of an entity property's column (`@Column({ name })`), looked up in the metadata of
 * a query alias (the main alias when `aliasName` is undefined). `undefined` when the alias has no
 * entity or the property isn't a column.
 */
export function getColumnDatabaseName(
  builder: WhereExpressionBuilder,
  aliasName: string | undefined,
  propertyPath: string
): string | undefined {
  const metadata = getAliasMetadata(builder as unknown as QueryBuilder<ObjectLiteral>, aliasName);

  return metadata?.findColumnWithPropertyPath(propertyPath)?.databaseName;
}

interface ResolvedTypedKey {
  /** Alias to qualify the column with; undefined on UPDATE / DELETE. */
  aliasName: string | undefined;
  /** Property path within the alias' entity: `status`, `url`, `address.city` (embedded). */
  propertyPath: string;
  metadata: EntityMetadata | undefined;
}

/**
 * Splits typed keys into the alias and the property path they refer to:
 * - `t => t.status` → the query's main alias + `status` (no alias on UPDATE / DELETE);
 * - `j => j.t.status`, `u => u.images.url` → the first key, when it is an alias of the query;
 * - `p => p.address.city` → when the first key isn't an alias but the main entity has a column
 *   with that path (an embedded entity), the main alias + `address.city`;
 * - anything else → the first key as the alias (an alias the query builder doesn't know yet,
 *   e.g. `q => q.base.chatRoomId` before `.from(…, 'base')`).
 *
 * Only single-level keys need the main alias, so `alias.column` keys work before `from()`.
 * Their column names can be mapped only through aliases already known to the query, though:
 * before `from()` the property name is used as the column name.
 */
function resolveTypedKey(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  keys: string[]
): ResolvedTypedKey {
  const prefixing = isAliasPrefixingEnabled(queryBuilder);

  if (keys.length === 1) {
    const aliasName = prefixing ? requireMainAliasName(queryBuilder, keys[0]) : undefined;

    return {
      aliasName,
      propertyPath: keys[0],
      metadata: getAliasMetadata(queryBuilder, aliasName),
    };
  }

  const [firstKey, ...restKeys] = keys;
  const expressionMap = queryBuilder.expressionMap;
  const mainAlias = expressionMap?.mainAlias;

  // UPDATE / DELETE have no alias to qualify with: `u => u.user.firstName` is `"firstName"` there
  if (!prefixing && mainAlias?.name === firstKey) {
    return {
      aliasName: undefined,
      propertyPath: restKeys.join('.'),
      metadata: getAliasMetadata(queryBuilder, undefined),
    };
  }

  const queryAlias = expressionMap?.aliases.find((alias) => alias.name === firstKey);

  if (!queryAlias && mainAlias) {
    const mainMetadata = getAliasMetadata(queryBuilder, undefined);
    const embeddedPath = keys.join('.');

    if (mainMetadata?.findColumnWithPropertyPath(embeddedPath)) {
      return {
        aliasName: prefixing ? mainAlias.name : undefined,
        propertyPath: embeddedPath,
        metadata: mainMetadata,
      };
    }
  }

  return {
    aliasName: firstKey,
    propertyPath: restKeys.join('.'),
    metadata: queryAlias?.hasMetadata ? queryAlias.metadata : undefined,
  };
}

/** `"alias"."column"` (or `"column"` without an alias) with the database column name. */
function toQuotedColumnKey(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  { aliasName, propertyPath, metadata }: ResolvedTypedKey
): string {
  const column =
    metadata?.findColumnWithPropertyPath(propertyPath)?.databaseName ?? propertyPath;

  return aliasName === undefined
    ? queryBuilder.escape(column)
    : `${queryBuilder.escape(aliasName)}.${queryBuilder.escape(column)}`;
}

/**
 * SQL key for a typed callback on `builder`: `"alias"."column"`, or `"column"` on UPDATE / DELETE.
 *
 * The property is mapped to its database column name (`@Column({ name })`, embedded columns)
 * through the metadata of the alias it belongs to (see `resolveTypedKey`). Aliases without
 * metadata (subqueries) and unknown properties keep the property name.
 */
export function getTypedColumnKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>
): string | string[] {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;

  const toKey = (keyHolder: KeyHolder): string =>
    toQuotedColumnKey(queryBuilder, resolveTypedKey(queryBuilder, keyHolder.getKeys()));

  const keyHolder = getKeyHolder<Type>(callback);

  return Array.isArray(keyHolder) ? keyHolder.map(toKey) : toKey(keyHolder);
}

/**
 * Quoted column of a typed callback that must select exactly one column
 * (`whereIsAnyTyped`, `whereArrayContainsTyped`, …). Throws a `TypeError` for several columns:
 * one condition per column has no single obvious meaning (AND? OR?), so don't guess.
 */
export function getTypedSingleColumnKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>,
  methodName: string
): string {
  const key = getTypedColumnKey<Type>(builder, callback);

  if (Array.isArray(key)) {
    throw new TypeError(
      `${methodName} expects the callback to select a single column, got ${key.length}: ${key.join(', ')}`
    );
  }

  return key;
}

/**
 * Key for typed select / order / distinct on a SelectQueryBuilder.
 *
 * Without quotes it is `alias.propertyPath` (`user.name`, `images.url`, `p.address.city`),
 * which TypeORM maps to the column itself. With `useQuotes` it is the quoted database column
 * (`"t"."ticket_status"`), since TypeORM doesn't map quoted keys. Strings are kept as is.
 */
export function getTypedSelectionKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  selection: KeyProxyCallback<Type> | string,
  useQuotes?: boolean
): string | string[] {
  if (typeof selection === 'string') {
    return selection;
  }

  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;

  const toKey = (keyHolder: KeyHolder): string => {
    const resolved = resolveTypedKey(queryBuilder, keyHolder.getKeys());

    if (useQuotes) {
      return toQuotedColumnKey(queryBuilder, resolved);
    }

    return resolved.aliasName === undefined
      ? resolved.propertyPath
      : `${resolved.aliasName}.${resolved.propertyPath}`;
  };

  const keyHolder = getKeyHolder<Type>(selection);

  return Array.isArray(keyHolder) ? keyHolder.map(toKey) : toKey(keyHolder);
}
