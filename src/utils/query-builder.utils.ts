import { QueryBuilder } from 'typeorm';
import type {
  DataSource,
  EntityMetadata,
  ObjectLiteral,
  QueryRunner,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { Alias } from 'typeorm/query-builder/Alias';
import { QueryExpressionMap } from 'typeorm/query-builder/QueryExpressionMap';
import type { KeyProxyCallback } from '../types/modules/proxy-callback.types';
import type { OrderType } from '../types/interfaces/ordering.interface';
import { createKeyTooDeepError, getKeyHolder, KeyHolder, MAX_KEY_DEPTH } from './proxy-key.utils';
import { isJsonColumn, JsonPathSqlOptions, toJsonPathSql } from './json-path.utils';
import { getDriverType, stringToSQLIdentifier } from './sql.utils';
import { isCalculated } from './calculated-column.utils';

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

type AliasScope = {
  expressionMap?: { aliases: Alias[]; mainAlias?: Alias };
  parentQueryBuilder?: AliasScope;
};

/**
 * The aliases of the query and of the queries it is part of, its own first. The builder of a `Brackets` callback
 * has the outer query's main alias but an empty alias list: the aliases, joins included, are on its parent. A
 * subquery sees the aliases of the outer query too.
 */
export function listQueryAliases(builder: WhereExpressionBuilder | QueryBuilder<ObjectLiteral>): Alias[] {
  const aliases: Alias[] = [];

  // parentQueryBuilder is protected in TypeORM's types
  for (let query = builder as unknown as AliasScope | undefined; query; query = query.parentQueryBuilder) {
    const { aliases: own = [], mainAlias } = query.expressionMap ?? {};

    aliases.push(...own, ...(mainAlias ? [mainAlias] : []));
  }

  return aliases;
}

/** An alias of the query by name, or of a query it is part of (see `listQueryAliases`). */
function findQueryAlias(queryBuilder: QueryBuilder<ObjectLiteral>, aliasName: string): Alias | undefined {
  return listQueryAliases(queryBuilder).find((candidate) => candidate.name === aliasName);
}

// private-use characters: no identifier or SQL that TypeORM builds contains them
const DEFERRED_KEY_START = '\uE000';
const DEFERRED_PROPERTY = '\uE001';
const DEFERRED_FIELD = '\uE002';
const DEFERRED_UNQUOTED = '\uE004';
const DEFERRED_KEY_END = '\uE003';
const DEFERRED_KEY = /\uE000([^\uE000-\uE004]+)([\uE001\uE002\uE004])([^\uE000-\uE004]+)\uE003/g;
const TWO_PART_FIELD = /^([A-Za-z_][\w$]*)\.([A-Za-z_][\w$]*)$/;

/**
 * Placeholder for a column of an alias the query doesn't have yet, e.g. a join added after the call: resolved when
 * the alias is added (`resolveAliasKeys`) or, at the latest, when the SQL is built (`resolveDeferredKeys`).
 */
function deferColumnKey(aliasName: string, separator: string, name: string): string {
  return `${DEFERRED_KEY_START}${aliasName}${separator}${name}${DEFERRED_KEY_END}`;
}

/**
 * SQL of a deferred key for `alias`, undefined while the query doesn't have it:
 * - a quoted key: the database column through the alias' entity, quoted, `"usr"."receipts_email"`; the name
 *   quoted without an entity;
 * - an unquoted one (select, order, group by, distinct without `useQuotes`): `alias.property` on an alias with an
 *   entity, which TypeORM maps and reads as a column of the entity; quoted on an alias without one (a subquery, a
 *   CTE), as on an alias known at the call, and on an alias the query never has, which only raw SQL adds (a LATERAL
 *   subquery in the condition of a raw join): TypeORM can't map it, and PostgreSQL would fold it to lower case.
 */
function toDeferredKeySql(
  alias: Alias | undefined,
  aliasName: string,
  separator: string,
  name: string,
  escape: (identifier: string) => string
): string {
  const metadata = metadataOf(alias);

  if (separator === DEFERRED_UNQUOTED) {
    return metadata ? `${aliasName}.${name}` : `${escape(aliasName)}.${escape(name)}`;
  }

  const column =
    metadata && (separator === DEFERRED_FIELD ? findColumn(metadata, name) : metadata.findColumnWithPropertyPath(name));
  const columnName = column && !column.isVirtualProperty ? column.databaseName : name;

  return `${escape(aliasName)}.${escape(columnName)}`;
}

/** Replaces placeholders of `deferColumnKey` in SQL built by `builder`, through the aliases it has by then. */
export function resolveDeferredKeys(builder: WhereExpressionBuilder, statement: string): string {
  if (typeof statement !== 'string' || !statement.includes(DEFERRED_KEY_START)) {
    return statement;
  }

  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;
  const escape = (identifier: string) => queryBuilder.escape(identifier);

  return statement.replace(DEFERRED_KEY, (_match, aliasName: string, separator: string, name: string) =>
    toDeferredKeySql(findQueryAlias(queryBuilder, aliasName), aliasName, separator, name, escape)
  );
}

/**
 * Resolves the placeholders of a new alias in select, order, group by and distinct on, which TypeORM reads before it
 * builds the SQL: a select of `alias.property` is how it knows to fill the property of a joined entity.
 */
function resolveAliasKeys(expressionMap: QueryExpressionMap, alias: Alias): void {
  // `connection` (TypeORM 0.3) or `dataSource` (1.x), protected in its types; read only when a key is found
  const { connection, dataSource } = expressionMap as unknown as { connection?: DataSource; dataSource?: DataSource };
  const escape = (identifier: string) => (connection ?? dataSource)!.driver.escape(identifier);
  const hasKey = (statement: unknown): statement is string =>
    typeof statement === 'string' && statement.includes(DEFERRED_KEY_START);
  const resolve = (statement: string) =>
    hasKey(statement)
      ? statement.replace(DEFERRED_KEY, (match, aliasName: string, separator: string, name: string) =>
          aliasName === alias.name ? toDeferredKeySql(alias, aliasName, separator, name, escape) : match
        )
      : statement;

  // new objects and arrays: a clone shares them with the query it was cloned from
  if (expressionMap.selects.some((select) => hasKey(select.selection))) {
    expressionMap.selects = expressionMap.selects.map((select) =>
      hasKey(select.selection) ? { ...select, selection: resolve(select.selection) } : select
    );
  }

  if (expressionMap.groupBys.some(hasKey)) {
    expressionMap.groupBys = expressionMap.groupBys.map(resolve);
  }

  if (expressionMap.selectDistinctOn?.some(hasKey)) {
    expressionMap.selectDistinctOn = expressionMap.selectDistinctOn.map(resolve);
  }

  if (Object.keys(expressionMap.orderBys).some(hasKey)) {
    expressionMap.orderBys = Object.fromEntries(
      Object.entries(expressionMap.orderBys).map(([key, order]) => [resolve(key), order])
    );
  }
}

const DEFERRED_KEYS_INSTALLED = Symbol.for('typeorm-extensions.deferredKeys');

function installDeferredKeyResolution(): void {
  const builderPrototype = QueryBuilder.prototype as unknown as Record<string | symbol, unknown>;
  const mapPrototype = QueryExpressionMap.prototype as unknown as Record<string | symbol, unknown>;

  if (builderPrototype[DEFERRED_KEYS_INSTALLED]) {
    return;
  }

  builderPrototype[DEFERRED_KEYS_INSTALLED] = true;

  // TypeORM 0.3.12 maps property names in each part of the query, later versions once in the whole query; keys are
  // resolved first, so an unquoted `alias.property` is mapped too
  for (const method of ['replacePropertyNames', 'replacePropertyNamesForTheWholeQuery']) {
    const original = builderPrototype[method];

    if (typeof original === 'function') {
      builderPrototype[method] = function (this: QueryBuilder<ObjectLiteral>, statement: string): string {
        return original.call(this, resolveDeferredKeys(this as unknown as WhereExpressionBuilder, statement));
      };
    }
  }

  const createAlias = mapPrototype.createAlias;

  if (typeof createAlias === 'function') {
    mapPrototype.createAlias = function (this: QueryExpressionMap, ...args: unknown[]): Alias {
      const alias: Alias = createAlias.apply(this, args);

      if (alias?.name) {
        resolveAliasKeys(this, alias);
      }

      return alias;
    };
  }
}

installDeferredKeyResolution();

const metadataOf = (alias: Alias | undefined): EntityMetadata | undefined =>
  alias?.hasMetadata ? alias.metadata : undefined;

/** Entity metadata of a query alias (the main alias when `aliasName` is undefined), if it has any. */
function getAliasMetadata(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  aliasName: string | undefined
): EntityMetadata | undefined {
  return metadataOf(
    aliasName === undefined ? queryBuilder.expressionMap?.mainAlias : findQueryAlias(queryBuilder, aliasName)
  );
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

/** A column of the entity by its database name (`first-name`) or its property path (`firstName`, `address.city`). */
function findColumn(metadata: EntityMetadata, name: string) {
  return (
    metadata.columns.find((column) => column.databaseName === name) ??
    metadata.findColumnWithPropertyPath(name)
  );
}

/**
 * The entity column a field names, the way `toFieldSql` resolves it: `alias.property` or
 * `alias.column_name` on an alias with an entity, or a database column name of the main alias.
 */
export function findFieldColumn(
  builder: WhereExpressionBuilder,
  field: string
): ColumnMetadata | undefined {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;
  const dot = field.indexOf('.');

  if (dot > 0) {
    const metadata = getAliasMetadata(queryBuilder, field.slice(0, dot));

    return metadata && findColumn(metadata, field.slice(dot + 1));
  }

  // only by database name: an unqualified property name may mean another table's column
  return getAliasMetadata(queryBuilder, undefined)?.columns.find(
    (column) => column.databaseName === field
  );
}

/**
 * SQL for a field passed as a string to the untyped methods (`whereIsIn('user.first-name', …)`).
 *
 * A string can't tell a column from an expression: `user.first-name` may be the column `first-name`
 * or `user.first` minus `name`. The query builder knows its aliases and their entities, though:
 * - `alias.column`, where `alias` is an alias of the query and `column` one of its entity's columns
 *   (by database name or property path): the column, quoted by the driver, `"user"."first-name"`.
 *   Property paths are mapped to their columns (`user.createdAt` → `"user"."created_at"`).
 *   UPDATE / DELETE give the bare column, as they have no alias.
 * - `column`, a database column name of the main entity: the quoted column, `"first-name"`. Property
 *   names aren't mapped without an alias, as `status` may also be a column of a joined table.
 * - anything else (unknown aliases, subqueries, expressions such as `LOWER(u.email)` or
 *   `u.price - u.discount`): quoted only when it is a path of plain identifiers, as
 *   `stringToSQLIdentifier` does, in the driver's quotes.
 */
export function toFieldSql(builder: WhereExpressionBuilder, field: string): string {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;
  const column = findFieldColumn(builder, field);
  const dot = field.indexOf('.');

  if (column) {
    const columnSql = queryBuilder.escape(column.databaseName);

    return dot > 0 && isAliasPrefixingEnabled(queryBuilder)
      ? `${queryBuilder.escape(field.slice(0, dot))}.${columnSql}`
      : columnSql;
  }

  const parts = dot > 0 ? TWO_PART_FIELD.exec(field) : null;

  if (parts && !findQueryAlias(queryBuilder, parts[1])) {
    return deferColumnKey(parts[1], DEFERRED_FIELD, parts[2]);
  }

  return stringToSQLIdentifier(field, getDriverType(builder));
}

interface ResolvedTypedKey {
  /** Alias to qualify the column with; undefined on UPDATE / DELETE. */
  aliasName: string | undefined;
  /** Property path within the alias' entity: `status`, `url`, `address.city` (embedded). */
  propertyPath: string;
  metadata: EntityMetadata | undefined;
  /** The column of `propertyPath`, when the alias has metadata and the property is a column. */
  column?: ColumnMetadata;
  /** Keys inside the JSON column `column`: `['meta', 'endTs']` for `e => e.details.meta.endTs`. */
  jsonPath?: string[];
}

type ColumnPath = Pick<ResolvedTypedKey, 'propertyPath' | 'column' | 'jsonPath'>;

/**
 * The column that `keys` name in an entity: the longest prefix of the keys that is a column's property path
 * (`address.city` for an embedded entity). The keys after it are a path inside the column, allowed only in a
 * JSON column (`details` + `['meta', 'endTs']`). `undefined` when no prefix is a column, or a column that isn't
 * JSON is followed by more keys (a relation's join column, `user` in `user.email`).
 */
function findColumnPath(metadata: EntityMetadata | undefined, keys: string[]): ColumnPath | undefined {
  for (let length = keys.length; metadata && length >= 1; length--) {
    const propertyPath = keys.slice(0, length).join('.');
    const column = metadata.findColumnWithPropertyPath(propertyPath);

    if (!column) {
      continue;
    }

    if (length === keys.length) {
      return { propertyPath, column };
    }

    return isJsonColumn(column) ? { propertyPath, column, jsonPath: keys.slice(length) } : undefined;
  }

  return undefined;
}

/**
 * Splits typed keys into the alias and the property path they refer to:
 * - `t => t.status` → the query's main alias + `status` (no alias on UPDATE / DELETE);
 * - `j => j.t.status`, `u => u.images.url` → the first key, when it is an alias of the query;
 * - `p => p.address.city` → when the first key isn't an alias but the main entity has a column
 *   with that path (an embedded entity), the main alias + `address.city`;
 * - `e => e.details.meta.endTs`, `j => j.e.details.outcome` → a JSON column of the alias' entity
 *   followed by the keys inside it (`jsonPath`), at any depth;
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
  const resolved = resolveTypedKeyPath(queryBuilder, keys);

  // deeper than `alias.column` only inside a JSON column: a nested relation can't be mapped to an alias
  if (!resolved.jsonPath && keys.length > MAX_KEY_DEPTH) {
    throw createKeyTooDeepError(keys);
  }

  // a @CalculatedColumn: TypeORM would write "alias"."property", a column the table doesn't have
  if (isCalculated(resolved.column)) {
    throw new TypeError(
      `${keys.join('.')} is a @CalculatedColumn, not a column of the table: use the SQL expression that fills it`
    );
  }

  return resolved;
}

/** The alias and property of the `@CalculatedColumn` a typed key picks; undefined for any other key. */
export function findTypedCalculatedProperty(
  builder: WhereExpressionBuilder,
  keyHolder: KeyHolder
): { aliasName: string | undefined; propertyPath: string } | undefined {
  const resolved = resolveTypedKeyPath(builder as unknown as QueryBuilder<ObjectLiteral>, keyHolder.getKeys());

  return isCalculated(resolved.column) ? { aliasName: resolved.aliasName, propertyPath: resolved.propertyPath } : undefined;
}

function resolveTypedKeyPath(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  keys: string[]
): ResolvedTypedKey {
  const prefixing = isAliasPrefixingEnabled(queryBuilder);

  if (keys.length === 1) {
    const aliasName = prefixing ? requireMainAliasName(queryBuilder, keys[0]) : undefined;
    const metadata = getAliasMetadata(queryBuilder, aliasName);

    return {
      aliasName,
      propertyPath: keys[0],
      metadata,
      column: metadata?.findColumnWithPropertyPath(keys[0]),
    };
  }

  const [firstKey, ...restKeys] = keys;
  const expressionMap = queryBuilder.expressionMap;
  const mainAlias = expressionMap?.mainAlias;

  // UPDATE / DELETE have no alias to qualify with: `u => u.user.firstName` is `"firstName"` there
  if (!prefixing && mainAlias?.name === firstKey) {
    const metadata = getAliasMetadata(queryBuilder, undefined);

    return {
      aliasName: undefined,
      propertyPath: restKeys.join('.'),
      metadata,
      ...findColumnPath(metadata, restKeys),
    };
  }

  const queryAlias = findQueryAlias(queryBuilder, firstKey);

  if (!queryAlias && mainAlias) {
    const mainMetadata = getAliasMetadata(queryBuilder, undefined);
    const columnPath = findColumnPath(mainMetadata, keys);

    if (columnPath) {
      return {
        aliasName: prefixing ? mainAlias.name : undefined,
        metadata: mainMetadata,
        ...columnPath,
      };
    }
  }

  const metadata = metadataOf(queryAlias);

  return {
    aliasName: firstKey,
    propertyPath: restKeys.join('.'),
    metadata,
    ...findColumnPath(metadata, restKeys),
  };
}

/**
 * `"alias"."column"` (or `"column"` without an alias) with the database column name, followed by the path
 * inside a JSON column: `"exec"."details" -> 'meta' ->> 'endTs'` (see `toJsonPathSql`).
 */
function toQuotedColumnKey(
  queryBuilder: QueryBuilder<ObjectLiteral>,
  { aliasName, propertyPath, metadata, column, jsonPath }: ResolvedTypedKey,
  jsonOptions?: JsonPathSqlOptions
): string {
  if (aliasName !== undefined && !metadata && !findQueryAlias(queryBuilder, aliasName)) {
    return deferColumnKey(aliasName, DEFERRED_PROPERTY, propertyPath);
  }

  const columnName = column?.databaseName ?? propertyPath;

  const columnSql =
    aliasName === undefined
      ? queryBuilder.escape(columnName)
      : `${queryBuilder.escape(aliasName)}.${queryBuilder.escape(columnName)}`;

  if (!column || !jsonPath) {
    return columnSql;
  }

  const driver = getDriverType(queryBuilder as unknown as WhereExpressionBuilder);

  return toJsonPathSql(driver, columnSql, column, jsonPath, jsonOptions);
}

/**
 * SQL key for a typed callback on `builder`: `"alias"."column"`, or `"column"` on UPDATE / DELETE.
 *
 * The property is mapped to its database column name (`@Column({ name })`, embedded columns)
 * through the metadata of the alias it belongs to (see `resolveTypedKey`). Aliases without
 * metadata (subqueries) and unknown properties keep the property name. A path into a JSON column
 * gives its JSON accessor, cast on PostgreSQL to the type of `jsonOptions.value`.
 */
export function getTypedColumnKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>,
  jsonOptions?: JsonPathSqlOptions
): string | string[] {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;

  const toKey = (keyHolder: KeyHolder): string =>
    toQuotedColumnKey(queryBuilder, resolveTypedKey(queryBuilder, keyHolder.getKeys()), jsonOptions);

  // the depth is checked against the query's metadata, where a JSON column may be deeper
  const keyHolder = getKeyHolder<Type>(callback, true);

  return Array.isArray(keyHolder) ? keyHolder.map(toKey) : toKey(keyHolder);
}

/** Whether a typed callback selects a path inside a JSON column, `u => u.metadata.tags`, rather than a column. */
export function isTypedJsonPath<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>
): boolean {
  const keyHolder = getKeyHolder<Type>(callback, true);

  return (
    !Array.isArray(keyHolder) &&
    Boolean(resolveTypedKey(builder as unknown as QueryBuilder<ObjectLiteral>, keyHolder.getKeys()).jsonPath)
  );
}

/**
 * Quoted column of a typed callback that must select exactly one column
 * (`whereIsAnyTyped`, `whereArrayContainsTyped`, …). Throws a `TypeError` for several columns:
 * one condition per column has no single obvious meaning (AND? OR?), so don't guess.
 */
export function getTypedSingleColumnKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>,
  methodName: string,
  jsonOptions?: JsonPathSqlOptions
): string {
  const key = getTypedColumnKey<Type>(builder, callback, jsonOptions);

  if (Array.isArray(key)) {
    throw new TypeError(
      `${methodName} expects the callback to select a single column, got ${key.length}: ${key.join(', ')}`
    );
  }

  return key;
}

/**
 * The alias and the entity property a typed callback picks, for methods that take a property rather than a column
 * (a `@CalculatedColumn`): `u => u.imagesCount` is on the main alias, `q => q.owner.imagesCount` on `owner`.
 */
export function resolveTypedProperty<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>,
  methodName: string
): { aliasName: string | undefined; propertyPath: string } {
  const keyHolder = getKeyHolder<Type>(callback);

  if (Array.isArray(keyHolder)) {
    throw new TypeError(`${methodName} expects the callback to pick a single property, got ${keyHolder.length}`);
  }

  const { aliasName, propertyPath } = resolveTypedKeyPath(
    builder as unknown as QueryBuilder<ObjectLiteral>,
    keyHolder.getKeys()
  );

  return { aliasName, propertyPath };
}

/**
 * Throws for a key that names no column of its table: a relation whose join column is on the other side
 * (one-to-many, many-to-many, the inverse side of a one-to-one) or an embedded entity. TypeORM leaves such a key
 * as written, and the database rejects it.
 */
function assertTableColumnKey({ metadata, propertyPath }: ResolvedTypedKey, keys: string[], methodName: string): void {
  const relation = metadata?.findRelationWithPropertyPath(propertyPath);

  if (relation && !relation.isManyToOne && !relation.isOneToOneOwner) {
    throw new TypeError(
      `${methodName}: "${keys.join('.')}" is a relation without a join column in its table. ` +
        `Join it and address its columns by the join alias`
    );
  }

  if (!relation && metadata?.findEmbeddedWithPropertyPath(propertyPath)) {
    throw new TypeError(
      `${methodName}: "${keys.join('.')}" is an embedded entity, not a column: address its columns, e.g. ` +
        `"${keys.join('.')}.someColumn"`
    );
  }
}

// an alias the query doesn't know yet is resolved when it is added (`resolveAliasKeys`)
function isAliasWithoutMetadata(queryBuilder: QueryBuilder<ObjectLiteral>, aliasName: string | undefined): boolean {
  const alias = aliasName === undefined ? undefined : findQueryAlias(queryBuilder, aliasName);

  return alias !== undefined && !alias.hasMetadata;
}

/**
 * Key for typed select / order / distinct / group by on a SelectQueryBuilder.
 *
 * Without quotes it is `alias.propertyPath` (`user.name`, `images.url`, `p.address.city`),
 * which TypeORM maps to the column itself. With `useQuotes` it is the quoted database column
 * (`"t"."ticket_status"`), since TypeORM doesn't map quoted keys. An alias of the query without
 * metadata (a subquery or a CTE in FROM or a join), or one the query still doesn't have when the SQL
 * is built, is quoted unless `useQuotes` is `false`: TypeORM leaves its keys as written, and
 * PostgreSQL folds an unquoted `cte.firstName` to `firstname`.
 * Strings are kept as is.
 */
export function getTypedSelectionKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  selection: KeyProxyCallback<Type> | KeyHolder | string,
  useQuotes?: boolean,
  columnsFor?: string
): string | string[] {
  if (typeof selection === 'string') {
    return selection;
  }

  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;

  const toKey = (keyHolder: KeyHolder): string => {
    const resolved = resolveTypedKey(queryBuilder, keyHolder.getKeys());

    if (resolved.jsonPath) {
      throw new TypeError(
        `Typed key "${keyHolder.getKeys().join('.')}" points into the JSON column "${resolved.propertyPath}": ` +
          `select, order, distinct and group by take columns only. For an expression use tableHelper().jsonColumn()`
      );
    }

    if (columnsFor !== undefined) {
      assertTableColumnKey(resolved, keyHolder.getKeys(), columnsFor);
    }

    if (useQuotes ?? isAliasWithoutMetadata(queryBuilder, resolved.aliasName)) {
      return toQuotedColumnKey(queryBuilder, resolved);
    }

    // an alias added later decides then: TypeORM maps an entity's keys, a subquery's are quoted
    if (
      useQuotes === undefined &&
      columnsFor !== undefined &&
      resolved.aliasName !== undefined &&
      !resolved.metadata &&
      !findQueryAlias(queryBuilder, resolved.aliasName)
    ) {
      return deferColumnKey(resolved.aliasName, DEFERRED_UNQUOTED, resolved.propertyPath);
    }

    return resolved.aliasName === undefined
      ? resolved.propertyPath
      : `${resolved.aliasName}.${resolved.propertyPath}`;
  };

  const keyHolder = getKeyHolder<Type>(selection);

  return Array.isArray(keyHolder) ? keyHolder.map(toKey) : toKey(keyHolder);
}

/**
 * The ORDER BY a query is built with, in the order it was applied. `allOrderBys`, not `orderBys`: it is what the SQL
 * is built from, so without an explicit order it falls back to the `orderBy` of @Entity, and respects the
 * `disable-global-order` option.
 */
export function getAppliedOrderBy<Entity extends ObjectLiteral>(builder: QueryBuilder<Entity>): OrderType[] {
  return Object.entries(builder.expressionMap.allOrderBys ?? {}).map(([key, value]) => {
    const selector = resolveDeferredKeys(builder as unknown as WhereExpressionBuilder, key);

    return typeof value === 'string'
      ? { selector, order: value }
      : { selector, order: value.order, nulls: value.nulls };
  });
}

/** The query without paging: no ORDER BY (nor the entity's default one), LIMIT, OFFSET, take or skip. */
export function withoutPaging<Entity extends ObjectLiteral>(query: SelectQueryBuilder<Entity>): SelectQueryBuilder<Entity> {
  return query
    .orderBy()
    .offset(undefined)
    .limit(undefined)
    .skip(undefined)
    .take(undefined)
    .setOption('disable-global-order');
}

/** The query runner a builder was created with, from a transactional manager; `undefined` for one from the pool. */
export function getQueryRunner<Entity extends ObjectLiteral>(builder: QueryBuilder<Entity>): QueryRunner | undefined {
  // queryRunner is protected in TypeORM's types
  return (builder as unknown as { queryRunner?: QueryRunner }).queryRunner;
}
