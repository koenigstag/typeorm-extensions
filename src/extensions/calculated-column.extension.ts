import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DriverUtils } from 'typeorm/driver/DriverUtils';
import { patchPrototype } from '../utils/prototype.utils';

/** `addSelect`'s selection: an SQL expression, or a factory that builds a subquery on the builder it is given. */
export type CalculatedSelection<SubEntity extends ObjectLiteral = ObjectLiteral> =
  | string
  | ((qb: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>);

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
      return addSelectCalculated(this, selection, property, alias);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

function addSelectCalculated<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  selection: CalculatedSelection<SubEntity>,
  property: string,
  aliasName?: string
): SelectQueryBuilder<Entity> {
  const { expressionMap } = builder;
  const alias =
    aliasName === undefined
      ? expressionMap.mainAlias
      : expressionMap.aliases.find((candidate) => candidate.name === aliasName);

  if (!alias?.hasMetadata) {
    throw new TypeError(
      `addSelectCalculated: the alias "${aliasName ?? alias?.name}" has no entity to select "${property}" into`
    );
  }

  const column = alias.metadata.findColumnWithPropertyPath(property);

  // @CalculatedColumn: a virtual property without the query of TypeORM's @VirtualColumn
  if (!column?.isVirtualProperty || column.query) {
    throw new TypeError(
      `addSelectCalculated: ${alias.metadata.name}.${property} is not a @CalculatedColumn`
    );
  }

  // the key TypeORM reads the column's value from when it builds the entity (shortened past the
  // driver's alias length limit, as TypeORM does it)
  const key = DriverUtils.buildAlias(builder.connection.driver, {}, alias.name, column.databaseName);

  // two calls: addSelect's overloads take a string or a factory, not their union
  if (typeof selection === 'function') {
    return builder.addSelect(selection, key);
  }

  return builder.addSelect(selection, key);
}
