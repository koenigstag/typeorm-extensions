import { InsertQueryBuilder, ObjectLiteral } from 'typeorm';
import { DriverUtils } from 'typeorm/driver/DriverUtils';
import { columnProxy, isColumnRef } from '../../../utils/column-proxy.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import type { ReturningColumn, ReturningRow } from '../typed-returning/typed-returning.extension';

// declarations

/** A property of the entity that is a column, or a relation with one join column. */
export type OnConflictTargetKey<Entity> = {
  [K in keyof Entity]-?: Entity[K] extends (...args: never[]) => unknown ? never : K;
}[keyof Entity] &
  string;

/** What `set` and `where` of `onConflictTyped` get: the row already in the table and the row that was proposed. */
export type OnConflictColumns<Entity> = {
  /** The existing row, qualified by the table or the alias of the insert. */
  readonly current: ReturningRow<Entity>;
  /** The row proposed for insertion: `EXCLUDED."column"`. */
  readonly excluded: ReturningRow<Entity>;
};

export type OnConflictTypedClause<Entity> = {
  /** The columns of the unique index or constraint the conflict is on. Required with `set`. */
  target?: ReadonlyArray<OnConflictTargetKey<Entity>>;
  /** The predicate of a partial unique index, over the bare columns: `c => \`${c.communityId} IS NULL\``. */
  targetWhere?: (columns: ReturningRow<Entity>) => string;
  /** `DO UPDATE SET`, as an object of properties and SQL; without it the insert does nothing on a conflict. */
  set?: (columns: OnConflictColumns<Entity>) => { [K in OnConflictTargetKey<Entity>]?: ReturningColumn };
  /** `DO UPDATE ... WHERE`: rows that fail it are left as they are. */
  where?: (columns: OnConflictColumns<Entity>) => string;
};

// keeps Type from being inferred from the clause, so it stays the entity of the builder
type NoInferType<T> = [T][T extends unknown ? 0 : never];

export interface TypedOnConflictMethods<Entity extends ObjectLiteral> {
  /**
   * `ON CONFLICT` with typed columns, on PostgreSQL and SQLite:
   * `onConflictTyped({ target: ['userId', 'roomId'], set: ({ excluded }) => ({ muted: excluded.muted, updatedAt: 'now()' }) })`.
   * Properties become their database names; `excluded` is the proposed row, `current` the existing one.
   * Without `set` it is `DO NOTHING`. Works on TypeORM 1.x too, which has no `onConflict()`.
   */
  onConflictTyped<Type extends ObjectLiteral = Entity>(clause: OnConflictTypedClause<NoInferType<Type>>): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/InsertQueryBuilder' {
  interface InsertQueryBuilder<Entity extends ObjectLiteral> extends TypedOnConflictMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// implementation

type InsertInternals = {
  expressionMap: { onConflict?: string };
  onConflict?: (statement: string) => unknown;
  getMainTableName(): string;
  getTableName(tablePath: string): string;
  createInsertExpression(): string;
  createReturningExpression(returningType: 'insert'): string;
};

const METHOD = 'onConflictTyped';

function renderClause<Entity extends ObjectLiteral>(
  builder: InsertQueryBuilder<Entity>,
  clause: OnConflictTypedClause<Entity>
): string {
  const driver = builder.connection.driver;
  const postgres = DriverUtils.isPostgresFamily(driver);

  if (!postgres && !DriverUtils.isSQLiteFamily(driver)) {
    throw new TypeError(`${METHOD}: ON CONFLICT is supported on PostgreSQL and SQLite only`);
  }

  const mainAlias = builder.expressionMap.mainAlias;

  if (!mainAlias?.hasMetadata) {
    throw new TypeError(`${METHOD}: insert into an entity, its metadata maps the properties`);
  }

  const { metadata } = mainAlias;

  const columnName = (path: string[]): string => {
    const propertyPath = path.join('.');
    const columns = metadata.findColumnsWithPropertyPath(propertyPath);

    if (columns.length !== 1) {
      throw new TypeError(
        columns.length === 0
          ? `${METHOD}: "${propertyPath}" is not a column of ${metadata.name}`
          : `${METHOD}: "${propertyPath}" of ${metadata.name} has ${columns.length} columns`
      );
    }

    return builder.escape(columns[0].databaseName);
  };

  const internals = builder as unknown as InsertInternals;
  const mainTableName = internals.getMainTableName();
  // TypeORM writes `INTO "table" AS "alias"` on PostgreSQL when the alias isn't the table name
  const currentTable =
    postgres && builder.alias !== mainTableName ? builder.escape(builder.alias) : internals.getTableName(mainTableName);

  const bare = columnProxy([], columnName) as ReturningRow<Entity>;
  const columns: OnConflictColumns<Entity> = {
    current: columnProxy([], (path) => `${currentTable}.${columnName(path)}`) as ReturningRow<Entity>,
    excluded: columnProxy([], (path) => `EXCLUDED.${columnName(path)}`) as ReturningRow<Entity>,
  };

  const { target = [], targetWhere, set, where } = clause;
  let sql = '';

  if (target.length) {
    sql += `(${target.map((key) => columnName([key])).join(', ')})`;

    if (targetWhere) {
      sql += ` WHERE ${targetWhere(bare)}`;
    }
  } else if (targetWhere) {
    throw new TypeError(`${METHOD}: targetWhere needs a target`);
  }

  if (!set) {
    if (where) {
      throw new TypeError(`${METHOD}: where applies to set, there is nothing to update`);
    }

    return `${sql} DO NOTHING`.trim();
  }

  if (!target.length) {
    throw new TypeError(`${METHOD}: set needs a target, the columns of the unique index`);
  }

  const values = set(columns);

  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new TypeError(`${METHOD}: set returns an object of properties and SQL, e.g. ({ excluded }) => ({ name: excluded.name })`);
  }

  const assignments = Object.entries(values).map(([property, value]) => {
    if (typeof value !== 'string' && !isColumnRef(value)) {
      throw new TypeError(`${METHOD}: "${property}" must be set to a column or an SQL expression`);
    }

    return `${columnName([property])} = ${String(value)}`;
  });

  if (!assignments.length) {
    throw new TypeError(`${METHOD}: set at least one column, or leave set out for DO NOTHING`);
  }

  sql += ` DO UPDATE SET ${assignments.join(', ')}`;

  if (where) {
    sql += ` WHERE ${where(columns)}`;
  }

  return sql;
}

// patching

const insertPrototype = InsertQueryBuilder.prototype as unknown as InsertInternals;
// TypeORM 1.x dropped onConflict(): the clause is put in front of RETURNING when the insert is built
const hasOnConflict = typeof insertPrototype.onConflict === 'function';

const extension: { prototype: Partial<InsertQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    onConflictTyped<Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
      this: InsertQueryBuilder<Entity>,
      clause: OnConflictTypedClause<Type>
    ): InsertQueryBuilder<Entity> {
      const sql = renderClause(this as unknown as InsertQueryBuilder<Type>, clause);
      const internals = this as unknown as InsertInternals;

      if (hasOnConflict) {
        internals.onConflict?.(sql);
      } else {
        internals.expressionMap.onConflict = sql;
      }

      return this;
    },
  },
};

patchPrototype(InsertQueryBuilder, extension);

// one install for every copy of the library a project loads: two would write the clause twice
const INSTALLED = Symbol.for('typeorm-extensions.onConflictTyped');

if (!hasOnConflict && !(insertPrototype as unknown as Record<symbol, unknown>)[INSTALLED]) {
  (insertPrototype as unknown as Record<symbol, unknown>)[INSTALLED] = true;

  const createInsertExpression = insertPrototype.createInsertExpression;

  insertPrototype.createInsertExpression = function (this: InsertInternals): string {
    const query = createInsertExpression.call(this);
    const clause = this.expressionMap.onConflict;

    if (!clause) {
      return query;
    }

    const returning = this.createReturningExpression('insert');
    const suffix = returning ? ` RETURNING ${returning}` : '';
    const head = suffix && query.endsWith(suffix) ? query.slice(0, -suffix.length) : query;

    return `${head} ON CONFLICT ${clause}${head === query ? '' : suffix}`;
  };
}
