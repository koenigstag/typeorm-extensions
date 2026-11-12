import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { patchPrototype } from '../utils/prototype.utils';
import { toFieldSql } from '../utils/query-builder.utils';
import { WhereMethods } from '../types/extensions';
import {
  createUniqueParameterName,
} from '../utils/sql.utils';

// declarations

/**
 * Conditions on PostgreSQL `jsonb` / `json` / `simple-json` columns. The column is cast to `jsonb`
 * (a no-op for `jsonb` columns, so a GIN index on them is still used).
 * `field` can also be a JSON expression, e.g. `tableHelper('u').jsonColumn('metadata', '->', 'settings')`.
 */
export interface WhereJsonMethods {
  /**
   * Sets WHERE `field @> :value` condition (PostgreSQL): the JSON document contains `value`,
   * e.g. `{ role: 'admin' }` matches `{ "role": "admin", "age": 30 }`.
   * `value` is serialized with `JSON.stringify`.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereJsonContains(field: string, value: unknown): this;

  /**
   * Adds new AND WHERE `field @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  andWhereJsonContains(field: string, value: unknown): this;

  /**
   * Adds new OR WHERE `field @> :value` condition (PostgreSQL): the JSON document contains `value`.
   */
  orWhereJsonContains(field: string, value: unknown): this;

  /**
   * Sets WHERE `field ? :key` condition (PostgreSQL): the JSON object has the top-level key
   * (or the JSON array has the string element).
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereJsonHasKey(field: string, key: string): this;

  /**
   * Adds new AND WHERE `field ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  andWhereJsonHasKey(field: string, key: string): this;

  /**
   * Adds new OR WHERE `field ? :key` condition (PostgreSQL): the JSON object has the top-level key.
   */
  orWhereJsonHasKey(field: string, key: string): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends WhereJsonMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereJsonMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends WhereJsonMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereJsonMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends WhereJsonMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const createWhereJsonContainsMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    value: unknown
  ): SelectQueryBuilder<Entity> {
    return attachWhereJsonContains<SelectQueryBuilder<Entity>>(this, method, field, value);
  };

const createWhereJsonHasKeyMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    key: string
  ): SelectQueryBuilder<Entity> {
    return attachWhereJsonHasKey<SelectQueryBuilder<Entity>>(this, method, field, key);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereJsonContains: createWhereJsonContainsMethod('where'),
    andWhereJsonContains: createWhereJsonContainsMethod('andWhere'),
    orWhereJsonContains: createWhereJsonContainsMethod('orWhere'),
    whereJsonHasKey: createWhereJsonHasKeyMethod('where'),
    andWhereJsonHasKey: createWhereJsonHasKeyMethod('andWhere'),
    orWhereJsonHasKey: createWhereJsonHasKeyMethod('orWhere'),
  },
};

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SoftDeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});

// implementation

/**
 * `CAST("table"."column" AS jsonb)`: makes `json` and `simple-json` (text) columns work, and is dropped by PostgreSQL
 * for `jsonb` columns, so it doesn't stop a GIN index from being used.
 */
function toJsonbOperand(builder: WhereExpressionBuilder, field: string): string {
  return `CAST(${toFieldSql(builder, field)} AS jsonb)`;
}

function attachWhereJsonContains<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  value: unknown
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  const json = JSON.stringify(value);

  if (json === undefined) {
    // `undefined` / functions have no JSON form; matching nothing or everything silently would hide the bug
    throw new TypeError(`JSON condition on "${field}" expects a JSON value, got ${String(value)}`);
  }

  const paramName = createUniqueParameterName(method);

  // CAST("table"."column" AS jsonb) @> CAST(:param AS jsonb), where :param is the JSON text
  return builder[method](
    `${toJsonbOperand(builder, field)} @> CAST(:${paramName} AS jsonb)`,
    { [paramName]: json }
  );
}

function attachWhereJsonHasKey<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  key: string
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  if (typeof key !== 'string') {
    throw new TypeError(`JSON key condition on "${field}" expects a string key, got ${String(key)}`);
  }

  const paramName = createUniqueParameterName(method);

  // the `?` operator, not jsonb_exists(): only the operator can use a GIN index
  return builder[method](
    `${toJsonbOperand(builder, field)} ? :${paramName}`,
    { [paramName]: key }
  );
}
