import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { RelationalKeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import { getSqlKey } from '../../../utils/proxy-key.utils';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    leftJoinTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity>;
    innerJoinTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity>;

    leftJoinAndSelectTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity>;
    innerJoinAndSelectTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity>;
  }
}

SelectQueryBuilder.prototype.leftJoinTyped = function <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  this: SelectQueryBuilder<Entity>,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  if (typeof selection === 'function') {
    return addJoin(this, 'leftJoin', selection, alias, condition, parameters);
  }

  return this;
};

SelectQueryBuilder.prototype.innerJoinTyped = function <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  this: SelectQueryBuilder<Entity>,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  if (typeof selection === 'function') {
    return addJoin(this, 'innerJoin', selection, alias, condition, parameters);
  }

  return this;
};

SelectQueryBuilder.prototype.leftJoinAndSelectTyped = function <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  this: SelectQueryBuilder<Entity>,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  if (typeof selection === 'function') {
    return addJoin(
      this,
      'leftJoinAndSelect',
      selection,
      alias,
      condition,
      parameters
    );
  }

  return this;
};

SelectQueryBuilder.prototype.innerJoinAndSelectTyped = function <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  this: SelectQueryBuilder<Entity>,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  if (typeof selection === 'function') {
    return addJoin(
      this,
      'innerJoinAndSelect',
      selection,
      alias,
      condition,
      parameters
    );
  }

  return this;
};

type JoinMethod =
  | 'leftJoin'
  | 'innerJoin'
  | 'leftJoinAndSelect'
  | 'innerJoinAndSelect';

function addJoin<
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  query: SelectQueryBuilder<Entity>,
  method: JoinMethod,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  const key = getSqlKey<Type>(selection, query.alias) as string;

  return query[method](key, alias, condition, parameters);
}
