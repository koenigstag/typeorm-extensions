import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { patchPrototype } from '../utils/prototype.utils';
import type { SubQueryFactory } from '../types/extensions/sub-query.types';
import { addSelectCalculatedColumn } from '../utils/calculated-column.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Selects an SQL expression into a `@CalculatedColumn` property of the main alias's entity:
     * `getMany()` / `getOne()` put the value into the entities, converted by the column's type.
     * The selection is `addSelect`'s: an expression or a subquery factory.
     *
     * The value is read when the entity is selected as a whole (the alias, not some of its columns).
     * Throws a `TypeError` if the property isn't a `@CalculatedColumn`.
     */
    addSelectCalculated<K extends keyof Entity & string, SubEntity extends ObjectLiteral = ObjectLiteral>(
      selection: string | SubQueryFactory<SubEntity>,
      property: K
    ): this;
    /** Selects into a `@CalculatedColumn` property of the entity of another alias, e.g. a joined one. */
    addSelectCalculated<SubEntity extends ObjectLiteral = ObjectLiteral>(
      selection: string | SubQueryFactory<SubEntity>,
      property: string,
      alias: string
    ): this;

  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    addSelectCalculated<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      selection: string | SubQueryFactory<SubEntity>,
      property: string,
      alias?: string
    ): SelectQueryBuilder<Entity> {
      return addSelectCalculatedColumn(this, selection, property, alias, 'addSelectCalculated');
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
