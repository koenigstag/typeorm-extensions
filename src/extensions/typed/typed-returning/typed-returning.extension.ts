import {
  ObjectLiteral,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import type { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import { getKeyHolder } from '../../../utils/proxy-key.utils';
import { patchPrototype } from '../../../utils/prototype.utils';

// declarations

export interface TypedReturningMethods<Entity extends ObjectLiteral> {
  /**
   * Sets the columns to return from entity properties: `RETURNING` on PostgreSQL and MariaDB, `OUTPUT` on SQL Server.
   * `returningTyped(u => [u.id, u.status])` returns the columns of `id` and `status`, whatever their
   * database names; the rows come in `execute()`'s `raw`. A property that isn't a column of the
   * entity throws a `TypeError` (TypeORM's `returning([...])` silently skips it).
   */
  returningTyped(selection: KeyProxyCallback<Entity>): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/InsertQueryBuilder' {
  interface InsertQueryBuilder<Entity extends ObjectLiteral> extends TypedReturningMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedReturningMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedReturningMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedReturningMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const extension: { prototype: Partial<UpdateQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    // the same implementation for the Insert, Update, Delete and SoftDelete builders
    returningTyped<Entity extends ObjectLiteral>(
      this: UpdateQueryBuilder<Entity>,
      selection: KeyProxyCallback<Entity>
    ): UpdateQueryBuilder<Entity> {
      const keyHolders = getKeyHolder<Entity>(selection);
      const paths = (Array.isArray(keyHolders) ? keyHolders : [keyHolders]).map((keyHolder) =>
        keyHolder.getKeys().join('.')
      );

      const mainAlias = this.expressionMap.mainAlias;

      if (!mainAlias?.hasMetadata) {
        // no entity to map properties with: return the columns by name
        return this.returning(paths.map((path) => this.escape(path)).join(', '));
      }

      for (const path of paths) {
        // a column, an embedded column (`address.city`) or a relation with join columns (`owner`)
        if (mainAlias.metadata.findColumnsWithPropertyPath(path).length === 0) {
          throw new TypeError(`returningTyped: "${path}" is not a column of ${mainAlias.metadata.name}`);
        }
      }

      return this.returning(paths);
    },
  },
};

const queryBuilders = [
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SoftDeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});
