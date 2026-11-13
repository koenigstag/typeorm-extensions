import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DriverUtils } from 'typeorm/driver/DriverUtils';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { createUniqueParameterName } from './sql.utils';

/** `addSelect`'s selection: an SQL expression, or a factory that builds a subquery on the builder it is given. */
export type CalculatedSelection<SubEntity extends ObjectLiteral = ObjectLiteral> =
  | string
  | ((qb: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<SubEntity>);

type ResolvedCalculatedColumn = {
  /** The key TypeORM reads the column's value from when it builds the entity. */
  key: string;
  /** `Entity.property`, for error messages. */
  label: string;
};

function findCalculatedColumn<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  property: string,
  aliasName?: string
): { aliasName: string; entityName: string; column: ColumnMetadata | undefined } | undefined {
  const { expressionMap } = builder;
  const alias =
    aliasName === undefined
      ? expressionMap.mainAlias
      : expressionMap.aliases.find((candidate) => candidate.name === aliasName);

  if (!alias?.hasMetadata) {
    return undefined;
  }

  return {
    aliasName: alias.name,
    entityName: alias.metadata.name,
    column: alias.metadata.findColumnWithPropertyPath(property),
  };
}

// @CalculatedColumn: a virtual property without the query of TypeORM's @VirtualColumn
const isCalculated = (column: ColumnMetadata | undefined): column is ColumnMetadata =>
  !!column?.isVirtualProperty && !column.query;

/** Whether `property` of the entity of `aliasName` (the main alias by default) is a `@CalculatedColumn`. */
export function isCalculatedColumn<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  property: string,
  aliasName?: string
): boolean {
  return isCalculated(findCalculatedColumn(builder, property, aliasName)?.column);
}

/** The `@CalculatedColumn` `property` of the entity of `aliasName`; throws a `TypeError` for anything else. */
export function resolveCalculatedColumn<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  property: string,
  aliasName: string | undefined,
  methodName: string
): ResolvedCalculatedColumn {
  const found = findCalculatedColumn(builder, property, aliasName);

  if (!found) {
    throw new TypeError(
      `${methodName}: the alias "${aliasName ?? builder.expressionMap.mainAlias?.name}" has no entity with "${property}"`
    );
  }

  const label = `${found.entityName}.${property}`;

  if (!isCalculated(found.column)) {
    throw new TypeError(`${methodName}: ${label} is not a @CalculatedColumn`);
  }

  // shortened past the driver's alias length limit, as TypeORM does it
  const key = DriverUtils.buildAlias(builder.connection.driver, {}, found.aliasName, found.column.databaseName);

  return { key, label };
}

/**
 * Selects the value of a `@CalculatedColumn`, already selected with `addSelectCalculated`, a second
 * time under a generated lower-case alias, and returns the alias to order by.
 *
 * The alias the entity is built from can't be ordered by: PostgreSQL folds it unquoted
 * (`user_imagesCount` → `user_imagescount`), and quoted it breaks the DISTINCT query TypeORM pages
 * through with `take` / `skip` and joins, which takes only select aliases it knows unquoted.
 */
export function selectCalculatedForOrder<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  property: string,
  aliasName: string | undefined,
  methodName: string
): string {
  const { key, label } = resolveCalculatedColumn(builder, property, aliasName, methodName);
  const select = builder.expressionMap.selects.find((candidate) => candidate.aliasName === key);

  if (!select) {
    throw new TypeError(`${methodName}: ${label} isn't selected: select it with addSelectCalculated first`);
  }

  const orderAlias = createUniqueParameterName('calculated').toLowerCase();

  // TypeORM keeps a subquery selection as its SQL, with its parameters already on the builder
  builder.addSelect(select.selection, orderAlias);

  return orderAlias;
}

/** Selects `selection` into the `@CalculatedColumn` `property` of the entity of `aliasName` (the main alias by default). */
export function addSelectCalculatedColumn<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  selection: CalculatedSelection<SubEntity>,
  property: string,
  aliasName: string | undefined,
  methodName: string
): SelectQueryBuilder<Entity> {
  const { key } = resolveCalculatedColumn(builder, property, aliasName, methodName);

  // two calls: addSelect's overloads take a string or a factory, not their union
  if (typeof selection === 'function') {
    return builder.addSelect(selection, key);
  }

  return builder.addSelect(selection, key);
}

/** ORDER BY the value of a `@CalculatedColumn` selected with `addSelectCalculated`, through `orderBy` or `addOrderBy`. */
export function orderByCalculatedColumn<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  method: 'orderBy' | 'addOrderBy',
  property: string,
  order: 'ASC' | 'DESC' | undefined,
  nulls: 'NULLS FIRST' | 'NULLS LAST' | undefined,
  aliasName: string | undefined,
  methodName: string
): SelectQueryBuilder<Entity> {
  const orderAlias = selectCalculatedForOrder(builder, property, aliasName, methodName);

  return builder[method](orderAlias, order, nulls);
}
