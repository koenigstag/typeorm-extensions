import type { ObjectLiteral } from 'typeorm';
import type { RelationalKeyProxyCallback } from '../../../types/modules/proxy-callback.types';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
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
