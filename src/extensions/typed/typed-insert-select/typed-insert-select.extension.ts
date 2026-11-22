import { InsertQueryBuilder, ObjectLiteral, WhereExpressionBuilder } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { isColumnRef } from '../../../utils/column-proxy.utils';
import { detachedQueryBuilder, toSubQuerySql } from '../../../utils/parameter.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { getDriverType, isSqliteLikeDriver } from '../../../utils/sql.utils';
import type { SubQuery } from '../../../types/extensions/sub-query.types';
import type { OnConflictTargetKey } from '../typed-on-conflict/typed-on-conflict.extension';

// declarations

/** The SQL each inserted column gets, by property, over the aliases of the select. */
export type InsertSelectColumns<Entity> = { [K in OnConflictTargetKey<Entity>]?: string };

// keeps Type from being inferred from the columns, so it stays the entity of the builder
type NoInferType<T> = [T][T extends unknown ? 0 : never];

export interface TypedInsertSelectMethods<Entity extends ObjectLiteral> {
  /**
   * `INSERT INTO … (columns) SELECT …`: the rows come from a select query instead of `values()`.
   * `columns` maps each property to the SQL its rows get, over the aliases of the select:
   * `valuesFromSelectTyped(sub => sub.from(User, 'u').where(…), { ownerId: 'u.id', status: "'new'" })`.
   * TypeORM still writes the statement (table, column list, `orIgnore`, `onConflictTyped`, `returning`); the select's
   * own selections are replaced by `columns`, in the order of that column list, and its parameters are renamed unique.
   * There is no entity, so listeners and subscribers do not run and nothing is updated from the returned rows.
   */
  valuesFromSelectTyped<Type extends ObjectLiteral = Entity>(
    subQuery: SubQuery,
    columns: InsertSelectColumns<NoInferType<Type>>
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/InsertQueryBuilder' {
  interface InsertQueryBuilder<Entity extends ObjectLiteral> extends TypedInsertSelectMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// implementation

type InsertSelectInternals = {
  expressionMap: {
    insertSelect?: string;
    insertColumns: string[];
    valuesSet?: ObjectLiteral | ObjectLiteral[];
    callListeners: boolean;
    updateEntity: boolean;
    mainAlias?: { hasMetadata: boolean };
  };
  getInsertedColumns(): ColumnMetadata[];
  getValueSets(): ObjectLiteral[];
  createValuesExpression(): string;
  createInsertExpression(): string;
  setParameters(parameters: ObjectLiteral): unknown;
};

const METHOD = 'valuesFromSelectTyped';
// what createValuesExpression returns in place of the values, swapped for the select once TypeORM wrote the statement;
// one marker and one install for every copy of the library a project loads, so the wrappers don't stack
const VALUES_MARKER = `/*typeorm-extensions:${METHOD}*/`;
const INSTALLED = Symbol.for('typeorm-extensions.insertSelect');

const insertPrototype = InsertQueryBuilder.prototype as unknown as InsertSelectInternals;
const supported = ['getInsertedColumns', 'getValueSets', 'createValuesExpression', 'createInsertExpression'].every(
  (name) => typeof (insertPrototype as unknown as Record<string, unknown>)[name] === 'function'
);

function renderSelect(builder: InsertSelectInternals, subQuery: SubQuery, columns: ObjectLiteral): void {
  if (!supported) {
    throw new TypeError(`${METHOD}: this TypeORM version builds inserts without the methods it extends`);
  }

  if (!builder.expressionMap.mainAlias?.hasMetadata) {
    throw new TypeError(`${METHOD}: insert into an entity, its metadata maps the properties`);
  }

  if (builder.expressionMap.valuesSet !== undefined) {
    throw new TypeError(`${METHOD}: the rows come from the select, leave values() out`);
  }

  const entries = Object.entries(columns).filter(([, sql]) => sql !== undefined);

  if (!entries.length) {
    throw new TypeError(`${METHOD}: give the SQL of at least one column`);
  }

  for (const [property, sql] of entries) {
    if (typeof sql !== 'string' && !isColumnRef(sql)) {
      throw new TypeError(`${METHOD}: "${property}" must be a column or an SQL expression`);
    }
  }

  builder.expressionMap.insertColumns = entries.map(([property]) => property);

  // TypeORM lists the columns in metadata order, whatever order insertColumns has
  const inserted = builder.getInsertedColumns();
  const listed = new Set(inserted.map((column) => column.propertyPath));
  const missing = entries.map(([property]) => property).filter((property) => !listed.has(property));

  if (missing.length) {
    throw new TypeError(`${METHOD}: ${missing.map((property) => `"${property}"`).join(', ')} not an inserted column of the entity`);
  }

  const sqlByProperty = new Map(entries.map(([property, sql]) => [property, String(sql)]));
  const query = (typeof subQuery === 'function' ? subQuery(detachedQueryBuilder(builder)) : subQuery).clone();

  // parenthesized, so TypeORM keeps each as written: a bare `alias.property` would become an entity column select,
  // and TypeORM moves those ahead of the others
  inserted.forEach((column, index) => {
    const selection = `(${sqlByProperty.get(column.propertyPath)})`;

    if (index === 0) {
      query.select(selection);
    } else {
      query.addSelect(selection);
    }
  });

  // SQLite reads an ON after the select's FROM as a join constraint, so ON CONFLICT needs a WHERE before it
  if (
    isSqliteLikeDriver(getDriverType(builder as unknown as WhereExpressionBuilder)) &&
    !query.expressionMap.wheres.length
  ) {
    query.where('1 = 1');
  }

  const [sql, parameters] = toSubQuerySql(query);

  builder.setParameters(parameters);
  builder.expressionMap.insertSelect = sql;
  builder.expressionMap.callListeners = false;
  builder.expressionMap.updateEntity = false;
}

// patching

const extension: { prototype: Partial<InsertQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    valuesFromSelectTyped<Entity extends ObjectLiteral>(
      this: InsertQueryBuilder<Entity>,
      subQuery: SubQuery,
      columns: ObjectLiteral
    ): InsertQueryBuilder<Entity> {
      renderSelect(this as unknown as InsertSelectInternals, subQuery, columns);

      return this;
    },
  },
};

patchPrototype(InsertQueryBuilder, extension);

if (supported && !(insertPrototype as unknown as Record<symbol, unknown>)[INSTALLED]) {
  (insertPrototype as unknown as Record<symbol, unknown>)[INSTALLED] = true;

  const { getValueSets, createValuesExpression, createInsertExpression } = insertPrototype;

  // one row stands for the select, so execute() runs the statement instead of returning on no values
  insertPrototype.getValueSets = function (this: InsertSelectInternals): ObjectLiteral[] {
    return this.expressionMap.insertSelect === undefined ? getValueSets.call(this) : [{}];
  };

  insertPrototype.createValuesExpression = function (this: InsertSelectInternals): string {
    if (this.expressionMap.insertSelect === undefined) {
      return createValuesExpression.call(this);
    }

    if (this.expressionMap.valuesSet !== undefined) {
      throw new TypeError(`${METHOD}: the rows come from the select, leave values() out`);
    }

    return VALUES_MARKER;
  };

  insertPrototype.createInsertExpression = function (this: InsertSelectInternals): string {
    const query = createInsertExpression.call(this);
    const select = this.expressionMap.insertSelect;

    if (select === undefined) {
      return query;
    }

    const values = ` VALUES ${VALUES_MARKER}`;

    if (!query.includes(values)) {
      throw new TypeError(`${METHOD}: TypeORM wrote this insert without a VALUES clause to put the select in`);
    }

    return query.replace(values, () => ` ${select}`);
  };
}
