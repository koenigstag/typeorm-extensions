import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import type { JoinAndMapTarget } from '../../../types/extensions/typed-join-and-map.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * TypeORM's `leftJoinAndMapOne` with the property to map to picked by a typed callback: `(u) => u.profile` is
     * `'user.profile'` on the main alias, `(q) => q.photo.owner` is `'photo.owner'` with an alias-keyed root.
     */
    leftJoinAndMapOneTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      mapToProperty: KeyProxyCallback<Type>,
      entity: JoinAndMapTarget,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
    /** TypeORM's `innerJoinAndMapOne` with the property to map to picked by a typed callback. */
    innerJoinAndMapOneTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      mapToProperty: KeyProxyCallback<Type>,
      entity: JoinAndMapTarget,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;

    /** TypeORM's `leftJoinAndMapMany` with the property to map to picked by a typed callback. */
    leftJoinAndMapManyTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      mapToProperty: KeyProxyCallback<Type>,
      entity: JoinAndMapTarget,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
    /** TypeORM's `innerJoinAndMapMany` with the property to map to picked by a typed callback. */
    innerJoinAndMapManyTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      mapToProperty: KeyProxyCallback<Type>,
      entity: JoinAndMapTarget,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): this;
  }
}

// patching

const createJoinAndMapTypedMethod = (method: JoinAndMapMethod) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    mapToProperty: KeyProxyCallback<Type>,
    entity: JoinAndMapTarget,
    alias: string,
    condition?: string,
    parameters?: ObjectLiteral
  ): SelectQueryBuilder<Entity> {
    return addJoinAndMap(this, method, mapToProperty, entity, alias, condition, parameters);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    leftJoinAndMapOneTyped: createJoinAndMapTypedMethod('leftJoinAndMapOne'),
    innerJoinAndMapOneTyped: createJoinAndMapTypedMethod('innerJoinAndMapOne'),
    leftJoinAndMapManyTyped: createJoinAndMapTypedMethod('leftJoinAndMapMany'),
    innerJoinAndMapManyTyped: createJoinAndMapTypedMethod('innerJoinAndMapMany'),
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

type JoinAndMapMethod =
  | 'leftJoinAndMapOne'
  | 'innerJoinAndMapOne'
  | 'leftJoinAndMapMany'
  | 'innerJoinAndMapMany';

function addJoinAndMap<
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = TypedRoot<Entity>
>(
  query: SelectQueryBuilder<Entity>,
  method: JoinAndMapMethod,
  mapToProperty: KeyProxyCallback<Type>,
  entity: JoinAndMapTarget,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
) {
  // `() => query.alias`: `(q) => q.photo.owner` needs no main alias, only `(u) => u.profile` does
  const key = getSqlKeyFromProxyCallback<Type>(mapToProperty, () => query.alias, false) as string;

  return query[method](key, entity, alias, condition, parameters);
}
