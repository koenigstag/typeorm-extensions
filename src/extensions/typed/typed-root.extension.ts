import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { WithTypedRoot } from '../../types/modules/typed-root.types';
import { patchPrototype } from '../../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the root of the typed callbacks of the calls that follow, instead of passing it to each of them:
     * the aliases of the query and their entities.
     *
     * Type-only: returns the builder itself. Call it once; a second call merges the roots.
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
    typed<Root extends ObjectLiteral>(): SelectQueryBuilder<WithTypedRoot<Entity, Root>>;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    typed<Entity extends ObjectLiteral, Root extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>
    ): SelectQueryBuilder<WithTypedRoot<Entity, Root>> {
      return this as unknown as SelectQueryBuilder<WithTypedRoot<Entity, Root>>;
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
