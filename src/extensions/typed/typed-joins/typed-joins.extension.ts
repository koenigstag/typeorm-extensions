import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { RelationalKeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    leftJoinTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
    innerJoinTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;

    leftJoinAndSelectTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
    innerJoinAndSelectTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      selection: RelationalKeyProxyCallback<Type>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
  }
}

// patching

SelectQueryBuilder.prototype.leftJoinTyped = function <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = TypedRoot<Entity>
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
  Type extends ObjectLiteral = TypedRoot<Entity>
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
  Type extends ObjectLiteral = TypedRoot<Entity>
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
  Type extends ObjectLiteral = TypedRoot<Entity>
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

// implementation

type JoinMethod =
  | 'leftJoin'
  | 'innerJoin'
  | 'leftJoinAndSelect'
  | 'innerJoinAndSelect';

function addJoin<
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = TypedRoot<Entity>
>(
  query: SelectQueryBuilder<Entity>,
  method: JoinMethod,
  selection: RelationalKeyProxyCallback<Type>,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  // `() => query.alias`: `(q) => q.base.images` needs no main alias, only `(u) => u.images` does
  const key = getSqlKeyFromProxyCallback<Type>(selection, () => query.alias, false) as string;

  return query[method](key, alias, condition, parameters);
}
