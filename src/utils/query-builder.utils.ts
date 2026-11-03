import type { ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';

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
