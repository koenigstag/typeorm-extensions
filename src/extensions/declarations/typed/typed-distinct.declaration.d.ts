import type { ObjectLiteral } from 'typeorm';
import type { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      ...distinctOn: Array<KeyProxyCallback<Type>>
    ): SelectQueryBuilder<Entity>;
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      distinctOn: KeyProxyCallback<Type>
    ): SelectQueryBuilder<Entity>;
  }
}
