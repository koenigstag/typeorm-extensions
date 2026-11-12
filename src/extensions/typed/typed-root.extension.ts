import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { EntityTarget } from 'typeorm';
import type { WithTypedRoot } from '../../types/modules/typed-root.types';
import { patchPrototype } from '../../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the root of the typed callbacks of the calls that follow, instead of passing it to each of them:
     * the aliases of the query and their entities.
     *
     * Type-only: returns the builder itself, marked with the root; its entity type stays. `from()` and `addFrom()`
     * keep the root, so it may go before them; a second call replaces it.
     *
     * @example
     * type Joins = { checkin: CheckIn; event: Event };
     *
     * checkInRepository
     *   .createQueryBuilder('checkin')
     *   .innerJoin('checkin.event', 'event')
     *   .typed<Joins>()
     *   .selectTyped((q) => q.checkin.customerId, 'customerId')
     *   .whereTyped((q) => q.event.eventType, '=', type) // instead of whereTyped<Joins>(…)
     */
    typed<Root extends ObjectLiteral>(): WithTypedRoot<SelectQueryBuilder<Entity>, Root>;

    // TypeORM's from() / addFrom() for a builder marked by typed(): the root names the aliases of the query, which a
    // FROM doesn't change. An unmarked builder isn't a `this` of these, and gets TypeORM's own.

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     * Removes all previously set from-s. Keeps the root set with `typed()`.
     */
    from<T extends ObjectLiteral, Root extends ObjectLiteral>(
      this: WithTypedRoot<unknown, Root>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entityTarget: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
      aliasName: string
    ): WithTypedRoot<SelectQueryBuilder<T>, Root>;
    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     * Removes all previously set from-s. Keeps the root set with `typed()`.
     */
    from<T extends ObjectLiteral, Root extends ObjectLiteral>(
      this: WithTypedRoot<unknown, Root>,
      entityTarget: EntityTarget<T>,
      aliasName: string
    ): WithTypedRoot<SelectQueryBuilder<T>, Root>;
    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data. Keeps the root set with `typed()`.
     */
    addFrom<T extends ObjectLiteral, Root extends ObjectLiteral>(
      this: WithTypedRoot<unknown, Root>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entityTarget: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
      aliasName: string
    ): WithTypedRoot<SelectQueryBuilder<T>, Root>;
    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data. Keeps the root set with `typed()`.
     */
    addFrom<T extends ObjectLiteral, Root extends ObjectLiteral>(
      this: WithTypedRoot<unknown, Root>,
      entityTarget: EntityTarget<T>,
      aliasName: string
    ): WithTypedRoot<SelectQueryBuilder<T>, Root>;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    typed<Entity extends ObjectLiteral, Root extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>
    ): WithTypedRoot<SelectQueryBuilder<Entity>, Root> {
      return this as WithTypedRoot<SelectQueryBuilder<Entity>, Root>;
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
