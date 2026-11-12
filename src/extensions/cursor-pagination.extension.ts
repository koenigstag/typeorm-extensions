import { ObjectLiteral } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { CursorPaginationFilter } from '../types/interfaces/cursor-pagination.interface';
import type {
  GetManyWithCursorOptions,
  ListWithCursor,
} from '../types/extensions/cursor-pagination.types';
import { defaultPageSize } from '../constants';
import { patchPrototype } from '../utils/prototype.utils';
import { toSqlOrderDirection } from '../utils/order.utils';
import { andWhereNarrowing } from '../utils/where.utils';
import { createUniqueParameterName } from '../utils/sql.utils';
import {
  buildKeysetCondition,
  decodeCursor,
  encodeCursor,
  getTextCastType,
  supportsRowValueComparison,
} from '../utils/cursor.utils';

export { InvalidCursorError } from '../utils/cursor.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    // generic over the entity of `this`: the property names of `orderBy` in a parameter would make the builder
    // invariant in its entity, and no SelectQueryBuilder<Entity> assignable to SelectQueryBuilder<ObjectLiteral>
    /**
     * Loads a page with keyset (cursor) pagination: instead of OFFSET, the rows after the last row of
     * the previous page, `WHERE (createdAt, id) < (:lastCreatedAt, :lastId)`. Pages stay fast however
     * deep they are, and rows inserted meanwhile don't shift them.
     *
     * Orders the query by `options.orderBy` (the primary key is appended), replacing its ORDER BY,
     * loads `pageSize + 1` rows to know whether there is a next page, and returns `nextCursor`
     * together with `hasMore`.
     * The query builder itself is not changed. Throws `InvalidCursorError` for a cursor that can't
     * be decoded or was made for another order.
     */
    getManyWithCursor<CursorEntity extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<CursorEntity>,
      cursorFilter: CursorPaginationFilter | null | undefined,
      options: GetManyWithCursorOptions<CursorEntity>
    ): Promise<ListWithCursor<CursorEntity>>;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    getManyWithCursor<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      cursorFilter: CursorPaginationFilter | null | undefined,
      options: GetManyWithCursorOptions<Entity>
    ): Promise<ListWithCursor<Entity>> {
      return getManyWithCursor<Entity>(this, cursorFilter, options);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

type CursorKey = {
  column: ColumnMetadata;
  direction: 'ASC' | 'DESC';
};

const isDateColumn = (column: ColumnMetadata): boolean =>
  column.type === Date || (typeof column.type === 'string' && /date|time/i.test(column.type));

/** The columns of `orderBy`, followed by the primary key columns that aren't among them. */
function getCursorKeys<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  orderBy: GetManyWithCursorOptions<Entity>['orderBy']
): CursorKey[] {
  const mainAlias = builder.expressionMap.mainAlias;

  if (!mainAlias?.hasMetadata) {
    throw new TypeError('getManyWithCursor needs a query on an entity (createQueryBuilder of a repository or an entity)');
  }

  const metadata = mainAlias.metadata;

  const keys: CursorKey[] = (orderBy ?? []).map(({ field, direction }) => {
    const column = metadata.findColumnWithPropertyPath(String(field));

    // a @CalculatedColumn is in the metadata, but not in the table
    if (!column || column.isVirtualProperty) {
      throw new TypeError(`getManyWithCursor: "${String(field)}" is not a column of ${metadata.name}`);
    }

    return { column, direction: toSqlOrderDirection(direction) };
  });

  // the primary key makes the order total: rows with equal keys can't be skipped or repeated
  const lastDirection = keys.length ? keys[keys.length - 1].direction : 'ASC';

  for (const column of metadata.primaryColumns) {
    if (!keys.some((key) => key.column === column)) {
      keys.push({ column, direction: lastDirection });
    }
  }

  return keys;
}

const getPageSize = (pageSize: number | undefined): number =>
  typeof pageSize === 'number' && Number.isFinite(pageSize) && pageSize >= 1
    ? Math.floor(pageSize)
    : defaultPageSize;

async function getManyWithCursor<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  cursorFilter: CursorPaginationFilter | null | undefined,
  options: GetManyWithCursorOptions<Entity>
): Promise<ListWithCursor<Entity>> {
  const { orderBy, useTakeAndSkip = false } = options ?? {};

  const keys = getCursorKeys(builder, orderBy);
  const fields = keys.map((key) => key.column.propertyPath);
  const pageSize = getPageSize(cursorFilter?.pageSize);

  const query = builder.clone();
  const alias = query.alias;
  const driver = query.connection.driver.options.type;
  const textCastType = getTextCastType(driver);

  const quotedColumn = (column: ColumnMetadata) =>
    `${query.escape(alias)}.${query.escape(column.databaseName)}`;

  if (cursorFilter?.cursor) {
    const values = decodeCursor(cursorFilter.cursor, fields);

    const keysetColumns = keys.map((key, i) => {
      const paramName = createUniqueParameterName(`cursor${i}`);
      query.setParameter(paramName, values[i]);

      return { column: quotedColumn(key.column), direction: key.direction, paramName };
    });

    andWhereNarrowing(query, buildKeysetCondition(keysetColumns, supportsRowValueComparison(driver)));
  }

  query.orderBy();
  keys.forEach((key) => query.addOrderBy(`${alias}.${key.column.propertyPath}`, key.direction));

  // the key values of the last row are read from the raw result: dates and times as text, so the
  // cursor keeps the database's precision (PostgreSQL timestamps have microseconds, a JS Date has not)
  const keyAliases = keys.map((key, i) => {
    const keyAlias = `cursor_key_${i}`;
    const column = quotedColumn(key.column);
    const selection = isDateColumn(key.column) && textCastType ? `CAST(${column} AS ${textCastType})` : column;

    query.addSelect(selection, keyAlias);

    return keyAlias;
  });

  const primaryAliases = keys
    .map((key, i) => ({ key, i }))
    .filter(({ key }) => key.column.isPrimary)
    .map(({ key, i }) => ({ column: key.column, keyAlias: keyAliases[i] }));

  if (useTakeAndSkip) {
    query.take(pageSize + 1);
  } else {
    query.limit(pageSize + 1);
  }

  const { entities, raw } = await query.getRawAndEntities();

  const list = entities.slice(0, pageSize);

  if (entities.length <= pageSize) {
    return { list, nextCursor: null, hasMore: false };
  }

  // with joined collections there are several raw rows per entity: find one of the last entity's
  const last = list[list.length - 1];
  const lastRaw = raw.find((row) =>
    primaryAliases.every(
      ({ column, keyAlias }) => String(row[keyAlias]) === String(column.getEntityValue(last))
    )
  );

  if (!lastRaw) {
    throw new Error('getManyWithCursor: could not find the key values of the last row');
  }

  const values = keyAliases.map((keyAlias, i) => {
    const value = lastRaw[keyAlias];

    if (value === null || value === undefined) {
      throw new TypeError(
        `getManyWithCursor: "${fields[i]}" is NULL in the last row; cursor keys must be non-null columns`
      );
    }

    return value;
  });

  return { list, nextCursor: encodeCursor(fields, values), hasMore: true };
}
