import { ObjectLiteral } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import type { CursorPaginationFilter } from '../types/interfaces/cursor-pagination.interface';
import type {
  GetManyWithCursorOptions,
  GetRawManyWithCursorOptions,
  ListWithCursor,
} from '../types/extensions/cursor-pagination.types';
import { normalizePageSize, setPageLimit } from '../utils/pagination.utils';
import { patchPrototype } from '../utils/prototype.utils';
import { toSqlOrderDirection } from '../utils/order.utils';
import { andWhereNarrowing } from '../utils/where.utils';
import { createUniqueParameterName } from '../utils/sql.utils';
import { getAppliedOrderBy } from '../utils/query-builder.utils';
import { isDate } from '../utils/common.utils';
import {
  buildKeysetCondition,
  decodeCursor,
  encodeCursor,
  getExpressionKeyName,
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

    /**
     * `getManyWithCursor` for raw rows (`getRawMany()`), ordered by SQL expressions, so a computed
     * value can be a key too: `CASE "member"."role" WHEN 'owner' THEN 0 ELSE 1 END`.
     *
     * Orders the query by `options.orderBy`, replacing its ORDER BY, and appends the primary key of
     * the main alias when the query is on an entity and has no GROUP BY or DISTINCT. Loads
     * `pageSize + 1` rows with LIMIT and returns `nextCursor` together with `hasMore`. The cursor
     * names the keys by a hash of their SQL, not the SQL itself.
     * The query builder itself is not changed. Throws `InvalidCursorError` for a cursor that can't
     * be decoded or was made for another order.
     */
    getRawManyWithCursor<Row = ObjectLiteral>(
      cursorFilter: CursorPaginationFilter | null | undefined,
      options: GetRawManyWithCursorOptions
    ): Promise<ListWithCursor<Row>>;
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
    getRawManyWithCursor<Entity extends ObjectLiteral, Row>(
      this: SelectQueryBuilder<Entity>,
      cursorFilter: CursorPaginationFilter | null | undefined,
      options: GetRawManyWithCursorOptions
    ): Promise<ListWithCursor<Row>> {
      return getRawManyWithCursor<Entity, Row>(this, cursorFilter, options);
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

async function getManyWithCursor<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  cursorFilter: CursorPaginationFilter | null | undefined,
  options: GetManyWithCursorOptions<Entity>
): Promise<ListWithCursor<Entity>> {
  const { orderBy, useTakeAndSkip = false } = options ?? {};

  const keys = getCursorKeys(builder, orderBy);
  const fields = keys.map((key) => key.column.propertyPath);
  const pageSize = normalizePageSize(cursorFilter?.pageSize);

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
  const appliedOrderBy = getAppliedOrderBy(query);

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

  setPageLimit(query, pageSize + 1, useTakeAndSkip);

  const { entities, raw } = await query.getRawAndEntities();

  const list = entities.slice(0, pageSize);

  if (entities.length <= pageSize) {
    return { list, nextCursor: null, hasMore: false, pageSize, orderBy: appliedOrderBy };
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

  return { list, nextCursor: encodeCursor(fields, values), hasMore: true, pageSize, orderBy: appliedOrderBy };
}

type ExpressionKey = {
  selector: string;
  direction: 'ASC' | 'DESC';
};

/** The expressions of `orderBy`, followed by the primary key of the main alias when it identifies a row. */
function getExpressionKeys<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  orderBy: GetRawManyWithCursorOptions['orderBy']
): ExpressionKey[] {
  const keys: ExpressionKey[] = (orderBy ?? []).map(({ selector, direction }) => {
    if (typeof selector !== 'string' || !selector.trim()) {
      throw new TypeError('getRawManyWithCursor: every orderBy key needs a selector');
    }

    return { selector, direction: toSqlOrderDirection(direction) };
  });

  const { expressionMap } = builder;
  const mainAlias = expressionMap.mainAlias;
  // grouped or distinct rows are not one per entity, and their primary key may not even be selectable
  const isRowPerEntity =
    expressionMap.groupBys.length === 0 &&
    !expressionMap.selectDistinct &&
    !expressionMap.selectDistinctOn?.length;

  if (mainAlias?.hasMetadata && isRowPerEntity) {
    const lastDirection = keys.length ? keys[keys.length - 1].direction : 'ASC';

    for (const column of mainAlias.metadata.primaryColumns) {
      const quoted = `${builder.escape(mainAlias.name)}.${builder.escape(column.databaseName)}`;
      const path = `${mainAlias.name}.${column.propertyPath}`;

      if (!keys.some((key) => key.selector === quoted || key.selector === path)) {
        keys.push({ selector: quoted, direction: lastDirection });
      }
    }
  }

  if (!keys.length) {
    throw new TypeError('getRawManyWithCursor: orderBy is empty and the query has no primary key to order by');
  }

  return keys;
}

async function getRawManyWithCursor<Entity extends ObjectLiteral, Row>(
  builder: SelectQueryBuilder<Entity>,
  cursorFilter: CursorPaginationFilter | null | undefined,
  options: GetRawManyWithCursorOptions
): Promise<ListWithCursor<Row>> {
  const keys = getExpressionKeys(builder, options?.orderBy);
  const fields = keys.map((key) => getExpressionKeyName(key.selector));
  const pageSize = normalizePageSize(cursorFilter?.pageSize);

  const query = builder.clone();
  const driver = query.connection.driver.options.type;
  const textCastType = getTextCastType(driver);

  if (cursorFilter?.cursor) {
    const values = decodeCursor(cursorFilter.cursor, fields);

    const keysetColumns = keys.map((key, i) => {
      const paramName = createUniqueParameterName(`cursor${i}`);
      query.setParameter(paramName, values[i]);

      // in parentheses: an expression may bind looser than the comparison
      return { column: `(${key.selector})`, direction: key.direction, paramName };
    });

    andWhereNarrowing(query, buildKeysetCondition(keysetColumns, supportsRowValueComparison(driver)));
  }

  query.orderBy();
  keys.forEach((key) => query.addOrderBy(key.selector, key.direction));
  const appliedOrderBy = getAppliedOrderBy(query);

  // the type of an expression is unknown here: each key is also read as text, which the cursor
  // takes instead when the driver returned a Date, so timestamps keep the database's precision
  const keyAliases = keys.map((key, i) => {
    const valueAlias = `cursor_key_${i}`;
    const textAlias = textCastType ? `cursor_text_${i}` : undefined;

    query.addSelect(key.selector, valueAlias);

    if (textAlias) {
      query.addSelect(`CAST((${key.selector}) AS ${textCastType})`, textAlias);
    }

    return { valueAlias, textAlias };
  });

  const addedAliases = new Set(
    keyAliases.flatMap(({ valueAlias, textAlias }) => (textAlias ? [valueAlias, textAlias] : [valueAlias]))
  );

  query.limit(pageSize + 1);

  const rows: ObjectLiteral[] = await query.getRawMany();
  const page = rows.slice(0, pageSize);
  const list = page.map(
    (row) => Object.fromEntries(Object.entries(row).filter(([column]) => !addedAliases.has(column))) as Row
  );

  if (rows.length <= pageSize) {
    return { list, nextCursor: null, hasMore: false, pageSize, orderBy: appliedOrderBy };
  }

  const last = page[page.length - 1];

  const values = keyAliases.map(({ valueAlias, textAlias }, i) => {
    const value = last[valueAlias];

    if (value === null || value === undefined) {
      throw new TypeError(
        `getRawManyWithCursor: "${keys[i].selector}" is NULL in the last row; cursor keys must not be NULL`
      );
    }

    return isDate(value) && textAlias ? last[textAlias] : value;
  });

  return { list, nextCursor: encodeCursor(fields, values), hasMore: true, pageSize, orderBy: appliedOrderBy };
}
