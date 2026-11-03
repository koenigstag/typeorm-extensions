import type { EntityMetadata, ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { KeyProxyCallback } from '../types/modules/proxy-callback.types';
import { getKeyHolder, KeyHolder } from './proxy-key.utils';

/**
 * Alias to qualify a single-level typed key with (`user.firstName`).
 *
 * UPDATE / DELETE builders turn alias prefixing off (`aliasNamePrefixingEnabled === false`)
 * and render `UPDATE "users" … WHERE …` without an alias, where `"UserEntity"."firstName"`
 * is invalid. Return no alias for them, so the key is just the column: `"firstName"`.
 */
export function getKeyPrefixAlias(builder: WhereExpressionBuilder): string | undefined {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;

  if (queryBuilder.expressionMap?.aliasNamePrefixingEnabled === false) {
    return undefined;
  }

  return queryBuilder.alias;
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
 * SQL key for a typed callback on `builder`: `"alias"."column"`, or `"column"` on UPDATE / DELETE.
 *
 * The property is mapped to its database column name (`@Column({ name })`) through the
 * metadata of the alias it belongs to: the query's alias for `t => t.status`, the first key
 * for `j => j.t.status` / `u => u.images.url`. Aliases without metadata (subqueries) and
 * unknown properties keep the property name.
 */
export function getTypedColumnKey<Type extends ObjectLiteral>(
  builder: WhereExpressionBuilder,
  callback: KeyProxyCallback<Type>
): string | string[] {
  const queryBuilder = builder as unknown as QueryBuilder<ObjectLiteral>;
  const prefixAlias = getKeyPrefixAlias(builder);

  const toKey = (keyHolder: KeyHolder): string => {
    const keys = keyHolder.getKeys();
    const [aliasName, propertyPath] =
      keys.length > 1 ? [keys[0], keys[1]] : [prefixAlias, keys[0]];

    const metadata = getAliasMetadata(queryBuilder, aliasName);
    const column =
      metadata?.findColumnWithPropertyPath(propertyPath)?.databaseName ?? propertyPath;

    return aliasName === undefined
      ? queryBuilder.escape(column)
      : `${queryBuilder.escape(aliasName)}.${queryBuilder.escape(column)}`;
  };

  const keyHolder = getKeyHolder<Type>(callback);

  return Array.isArray(keyHolder) ? keyHolder.map(toKey) : toKey(keyHolder);
}
