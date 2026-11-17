import {
  ObjectLiteral,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { patchPrototypes } from '../../../utils/prototype.utils';

// declarations

/** The SQL of one returned column. It can be a value of the returned object or go into an expression. */
export type ReturningColumn = string;

/**
 * The columns of the written row: a property gives its column (`"ticket_status"`), an embedded
 * property its columns (`p.address.city`), a relation with one join column that column.
 */
export type ReturningRow<Entity> = {
  readonly [K in keyof Entity as Entity[K] extends (...args: never[]) => unknown ? never : K]-?: NonNullable<
    Entity[K]
  > extends Date | readonly unknown[]
    ? ReturningColumn
    : NonNullable<Entity[K]> extends ObjectLiteral
      ? ReturningColumn & ReturningRow<NonNullable<Entity[K]>>
      : ReturningColumn;
};

/**
 * What the `returningTyped` callback gets: the columns of the written row, and on PostgreSQL 18+
 * `old` and `new`, the row before and after the write (`old` is all NULL for an inserted row,
 * `new` for a deleted one). A column named `old` or `new` is shadowed by them.
 */
export type ReturningColumns<Entity> = Omit<ReturningRow<Entity>, 'old' | 'new'> & {
  readonly old: ReturningRow<Entity>;
  readonly new: ReturningRow<Entity>;
};

export interface TypedReturningMethods<Entity extends ObjectLiteral> {
  /**
   * Sets what the write returns, as an object of output names: `RETURNING` on PostgreSQL and MariaDB, `OUTPUT` on SQL Server.
   * `returningTyped(t => ({ id: t.id, status: t.status }))` returns rows `{ id, status }` in `execute()`'s `raw`,
   * whatever the database names of the columns. A value is a column or an SQL expression built from them;
   * `old` / `new` (PostgreSQL 18+) give the row before and after the write. Exactly the listed outputs are returned.
   * A property that isn't a column throws a `TypeError`.
   */
  returningTyped<Type extends ObjectLiteral = Entity>(
    selection: (columns: ReturningColumns<Type>) => Record<string, ReturningColumn>
  ): this;
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

// implementation

const COLUMN_REF = Symbol('returningTyped column');

type ColumnRef = { readonly [COLUMN_REF]: true };

const isColumnRef = (value: unknown): value is ColumnRef =>
  (typeof value === 'function' || typeof value === 'object') && value !== null && COLUMN_REF in value;

/** A property path read lazily: it becomes SQL when it is used as a string. */
const columnProxy = (path: string[], toSql: (path: string[]) => string, members: Record<string, unknown> = {}): unknown =>
  new Proxy(() => undefined, {
    has: (_target, key) => key === COLUMN_REF,
    get: (_target, key) => {
      if (key === COLUMN_REF) {
        return true;
      }

      if (key === Symbol.toPrimitive || key === 'toString' || key === 'valueOf') {
        return () => toSql(path);
      }

      if (typeof key !== 'string' || key === 'then') {
        return undefined;
      }

      if (key in members) {
        return members[key];
      }

      return columnProxy([...path, key], toSql);
    },
  });

// patching

const extension: { prototype: Partial<UpdateQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    // the same implementation for the Insert, Update, Delete and SoftDelete builders
    returningTyped<Entity extends ObjectLiteral, Type extends ObjectLiteral = Entity>(
      this: UpdateQueryBuilder<Entity>,
      selection: (columns: ReturningColumns<Type>) => Record<string, ReturningColumn>
    ): UpdateQueryBuilder<Entity> {
      const mainAlias = this.expressionMap.mainAlias;
      const driver = this.connection.driver;
      const queryType = this.expressionMap.queryType;

      const columnName = (path: string[]): string => {
        const propertyPath = path.join('.');

        if (!mainAlias?.hasMetadata) {
          // no entity to map properties with: the property is the column
          return this.escape(propertyPath);
        }

        const columns = mainAlias.metadata.findColumnsWithPropertyPath(propertyPath);

        if (columns.length !== 1) {
          throw new TypeError(
            columns.length === 0
              ? `returningTyped: "${propertyPath}" is not a column of ${mainAlias.metadata.name}`
              : `returningTyped: "${propertyPath}" of ${mainAlias.metadata.name} has ${columns.length} columns, return them one by one`
          );
        }

        return this.escape(columns[0].databaseName);
      };

      const currentRow = (path: string[]): string => {
        const name = columnName(path);

        if (driver.options.type !== 'mssql') {
          return name;
        }

        // OUTPUT reads the written row from INSERTED, a deleted one from the table, as TypeORM's returning() does
        const mainTableName = (this as unknown as { getMainTableName(): string }).getMainTableName();

        return queryType === 'delete' ? `${this.escape(mainTableName)}.${name}` : `INSERTED.${name}`;
      };

      const rowVersion = (version: 'old' | 'new') => (path: string[]): string => {
        if (driver.options.type !== 'postgres') {
          throw new TypeError(`returningTyped: "${version}" is supported on PostgreSQL 18+ only`);
        }

        return `${version}.${columnName(path)}`;
      };

      const columns = columnProxy([], currentRow, {
        old: columnProxy([], rowVersion('old')),
        new: columnProxy([], rowVersion('new')),
      }) as ReturningColumns<Type>;

      const outputs = selection(columns);

      if (outputs === null || typeof outputs !== 'object' || Array.isArray(outputs)) {
        throw new TypeError('returningTyped: return an object of output names, e.g. t => ({ id: t.id })');
      }

      const expressions = Object.entries(outputs).map(([name, value]) => {
        if (typeof value !== 'string' && !isColumnRef(value)) {
          throw new TypeError(`returningTyped: "${name}" must be a column or an SQL expression`);
        }

        return `${String(value)} AS ${this.escape(name)}`;
      });

      if (expressions.length === 0) {
        throw new TypeError('returningTyped: return at least one output');
      }

      return this.returning(expressions.join(', '));
    },
  },
};

patchPrototypes([InsertQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder, SoftDeleteQueryBuilder], extension);
