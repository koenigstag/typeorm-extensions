import '../../where-array.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedSingleColumnKey, isTypedJsonPath } from '../../../utils/query-builder.utils';
import { createUniqueParameterName } from '../../../utils/sql.utils';
import type { WhereMethods } from '../../../types/extensions';
import { patchPrototype } from '../../../utils/prototype.utils';
import { ArgsType } from '../../../types/util-types';
import type { WhereArrayMethods } from '../../where-array.extension';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

/**
 * Typesafe conditions on PostgreSQL array columns: the column comes from an entity property.
 * See {@link WhereArrayMethods}.
 */
export interface TypedWhereArrayMethods<Entity extends ObjectLiteral> {
  /**
   * Sets WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   */
  andWhereArrayContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column @> :values` condition (PostgreSQL): the array column contains every value.
   */
  orWhereArrayContainsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Sets WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayContainedByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  andWhereArrayContainedByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column <@ :values` condition (PostgreSQL): every element of the array column is one of the values.
   */
  orWhereArrayContainedByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Sets WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   * If you had previously WHERE expression defined,
   * calling this function will override previously set WHERE conditions.
   */
  whereArrayOverlapsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new AND WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  andWhereArrayOverlapsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;

  /**
   * Adds new OR WHERE `column && :values` condition (PostgreSQL): the array column has at least one of the values.
   */
  orWhereArrayOverlapsTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedWhereArrayMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedWhereArrayMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const createWhereArrayTypedMethod = (method: keyof WhereArrayMethods) =>
  function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
    this: SelectQueryBuilder<Entity>,
    where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    values: ArgsType,
    arrayType?: string
  ): SelectQueryBuilder<Entity> {
    return attachWhereArrayTyped<Type, SelectQueryBuilder<Entity>>(
      this,
      method,
      where,
      values,
      arrayType
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereArrayContainsTyped: createWhereArrayTypedMethod('whereArrayContains'),
    andWhereArrayContainsTyped: createWhereArrayTypedMethod('andWhereArrayContains'),
    orWhereArrayContainsTyped: createWhereArrayTypedMethod('orWhereArrayContains'),
    whereArrayContainedByTyped: createWhereArrayTypedMethod('whereArrayContainedBy'),
    andWhereArrayContainedByTyped: createWhereArrayTypedMethod('andWhereArrayContainedBy'),
    orWhereArrayContainedByTyped: createWhereArrayTypedMethod('orWhereArrayContainedBy'),
    whereArrayOverlapsTyped: createWhereArrayTypedMethod('whereArrayOverlaps'),
    andWhereArrayOverlapsTyped: createWhereArrayTypedMethod('andWhereArrayOverlaps'),
    orWhereArrayOverlapsTyped: createWhereArrayTypedMethod('orWhereArrayOverlaps'),
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

function attachWhereArrayTyped<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: keyof WhereArrayMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  values: ArgsType,
  arrayType?: string
): QB {
  if (typeof where !== 'function') {
    return builder;
  }

  const key = getTypedSingleColumnKey<Type>(builder, where, `${method}Typed`);

  if (isTypedJsonPath<Type>(builder, where)) {
    return attachWhereJsonArray(builder, method, where, values, arrayType);
  }

  // .andWhereArrayContains(`"table"."column"`, ['value'])
  return builder[method](key, values, arrayType);
}

const JSON_ARRAY_METHOD = /^(where|andWhere|orWhere)Array(Contains|ContainedBy|Overlaps)$/;

const JSON_ARRAY_OPERATORS = { Contains: '@>', ContainedBy: '<@', Overlaps: '?|' } as const;

/**
 * The array conditions on an array inside a JSON column, with jsonb operators: `@>` and `<@` against the
 * values as a JSON array, and `?|` (any of the strings is an element) for the overlap. Empty arrays keep
 * PostgreSQL's semantics, as for array columns.
 */
function attachWhereJsonArray<Type extends ObjectLiteral, QB extends WhereExpressionBuilder>(
  builder: QB,
  method: keyof WhereArrayMethods,
  where: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
  values: ArgsType,
  arrayType: string | undefined
): QB {
  const methodName = `${method}Typed`;
  const [, whereMethod, condition] = JSON_ARRAY_METHOD.exec(method) as unknown as [
    string,
    WhereMethods,
    keyof typeof JSON_ARRAY_OPERATORS,
  ];

  if (!Array.isArray(values)) {
    throw new TypeError(`${methodName} expects an array of values, got ${values}`);
  }

  if (arrayType !== undefined) {
    throw new TypeError(`${methodName}: arrayType is for array columns, not for an array inside a JSON column`);
  }

  const jsonArray = `CAST(${getTypedSingleColumnKey<Type>(builder, where, methodName, { accessor: 'json' })} AS jsonb)`;
  const paramName = createUniqueParameterName(whereMethod);
  // a string or an object at the path isn't an array, but <@ and ?| would match it
  const onArray = (condition: string) => `(jsonb_typeof(${jsonArray}) = 'array' AND ${condition})`;

  if (condition === 'Overlaps') {
    if (!values.every((value) => typeof value === 'string')) {
      throw new TypeError(`${methodName} on an array inside a JSON column takes strings: the ?| operator matches string elements`);
    }

    return builder[whereMethod](onArray(`${jsonArray} ?| CAST(:${paramName} AS text[])`), { [paramName]: values });
  }

  return builder[whereMethod](
    onArray(`${jsonArray} ${JSON_ARRAY_OPERATORS[condition]} CAST(:${paramName} AS jsonb)`),
    { [paramName]: JSON.stringify(values) }
  );
}
