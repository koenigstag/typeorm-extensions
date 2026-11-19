import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { patchPrototype } from '../utils/prototype.utils';
import {
  addSelectCalculatedColumn,
  CalculatedSelection,
  orderByCalculatedColumn,
} from '../utils/calculated-column.utils';

export type { CalculatedSelection };

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
      selection: CalculatedSelection<SubEntity>,
      property: K
    ): this;
    /** Selects into a `@CalculatedColumn` property of the entity of another alias, e.g. a joined one. */
    addSelectCalculated<SubEntity extends ObjectLiteral = ObjectLiteral>(
      selection: CalculatedSelection<SubEntity>,
      property: string,
      alias: string
    ): this;

    /**
     * Sets ORDER BY the value of a `@CalculatedColumn` property of the main alias's entity, selected
     * with `addSelectCalculated` first. Replaces the previous ORDER BY, like `orderBy`.
     *
     * The value is selected a second time under a generated alias (`calculated_…`) and ordered by it,
     * which also works with `take` / `skip` and joins; it shows up in `getRawMany()` results.
     * Throws a `TypeError` if the property isn't a selected `@CalculatedColumn`.
     */
    orderByCalculated<K extends keyof Entity & string>(
      property: K,
      order?: 'ASC' | 'DESC',
      nulls?: 'NULLS FIRST' | 'NULLS LAST'
    ): this;
    /** Sets ORDER BY a `@CalculatedColumn` property of the entity of another alias, e.g. a joined one. */
    orderByCalculated(
      property: string,
      order: 'ASC' | 'DESC' | undefined,
      nulls: 'NULLS FIRST' | 'NULLS LAST' | undefined,
      alias: string
    ): this;

    /** Adds ORDER BY the value of a `@CalculatedColumn` property, like `addOrderBy` (see `orderByCalculated`). */
    addOrderByCalculated<K extends keyof Entity & string>(
      property: K,
      order?: 'ASC' | 'DESC',
      nulls?: 'NULLS FIRST' | 'NULLS LAST'
    ): this;
    /** Adds ORDER BY a `@CalculatedColumn` property of the entity of another alias. */
    addOrderByCalculated(
      property: string,
      order: 'ASC' | 'DESC' | undefined,
      nulls: 'NULLS FIRST' | 'NULLS LAST' | undefined,
      alias: string
    ): this;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    addSelectCalculated<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      selection: CalculatedSelection<SubEntity>,
      property: string,
      alias?: string
    ): SelectQueryBuilder<Entity> {
      return addSelectCalculatedColumn(this, selection, property, alias, 'addSelectCalculated');
    },

    orderByCalculated<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      property: string,
      order?: 'ASC' | 'DESC',
      nulls?: 'NULLS FIRST' | 'NULLS LAST',
      alias?: string
    ): SelectQueryBuilder<Entity> {
      return orderByCalculatedColumn(this, 'orderBy', property, order, nulls, alias, 'orderByCalculated');
    },

    addOrderByCalculated<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      property: string,
      order?: 'ASC' | 'DESC',
      nulls?: 'NULLS FIRST' | 'NULLS LAST',
      alias?: string
    ): SelectQueryBuilder<Entity> {
      return orderByCalculatedColumn(this, 'addOrderBy', property, order, nulls, alias, 'addOrderByCalculated');
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
