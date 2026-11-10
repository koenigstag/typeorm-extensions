import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DeepUnwrapArray, KeyProxyCallback, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { TypedWhereArgs, TypeOrDefault, UnsetType } from '../../../types/modules/typed-params.types';
import type { HavingMethods } from '../../../types/extensions/where.types';
import type { TypedAggregate } from '../../../types/extensions/typed-having.types';
import type { TypedWhereOptions } from '../../../types/extensions/typed-where.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { attachWhere, isParamsObject } from '../../../utils/where.utils';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

type Selection<Entity extends ObjectLiteral, Type, Value> = (proxy: DeepUnwrapArray<TypeOrDefault<Type, TypedRoot<Entity>>>) => Value;

/** `'*'`, all the rows, only for COUNT. */
type CountAll<Aggregate> = Aggregate extends 'COUNT' ? '*' : never;

/** The value an aggregate is compared with: a count, a sum or an average is a number, MIN / MAX the column's value. */
type AggregateValue<Aggregate, Value> = Aggregate extends 'MIN' | 'MAX' ? Value : number;

// declarations

/**
 * Typesafe HAVING conditions on an aggregate of an entity property: `havingTyped('COUNT', u => u.images.id, '>=', 2)`
 * gives `HAVING COUNT("images"."id") >= :having_…`. Parameters work as in `whereTyped`; with `strictParams` the
 * value is a number for COUNT, SUM and AVG, and the column's value for MIN and MAX. `'*'` counts every row.
 *
 * One signature, not overloads: with overloads TypeScript checks the other arguments before the arrow
 * function, and the column type would not be known for the value.
 */
export interface TypedHavingMethods<Entity extends ObjectLiteral> {
  /** Sets HAVING `aggregate(column) condition`, replacing the previous HAVING. */
  havingTyped<
    Type extends ObjectLiteral = UnsetType,
    Aggregate extends TypedAggregate = TypedAggregate,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    aggregate: Aggregate,
    selection: Selection<Entity, Type, Value> | CountAll<Aggregate>,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, AggregateValue<Aggregate, Value>>
  ): this;

  /** Adds AND HAVING `aggregate(column) condition`. */
  andHavingTyped<
    Type extends ObjectLiteral = UnsetType,
    Aggregate extends TypedAggregate = TypedAggregate,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    aggregate: Aggregate,
    selection: Selection<Entity, Type, Value> | CountAll<Aggregate>,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, AggregateValue<Aggregate, Value>>
  ): this;

  /** Adds OR HAVING `aggregate(column) condition`. */
  orHavingTyped<
    Type extends ObjectLiteral = UnsetType,
    Aggregate extends TypedAggregate = TypedAggregate,
    Value extends ProxyColumnValueType = ProxyColumnValueType,
    Operator extends string = string,
  >(
    aggregate: Aggregate,
    selection: Selection<Entity, Type, Value> | CountAll<Aggregate>,
    conditions: Operator,
    ...args: TypedWhereArgs<Type, Operator, AggregateValue<Aggregate, Value>>
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedHavingMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

type AnySelection = '*' | KeyProxyCallback<ObjectLiteral>;

const createHavingMethod = (method: HavingMethods) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    aggregate: TypedAggregate,
    selection: AnySelection,
    conditions: string,
    parameters?: unknown,
    options?: TypedWhereOptions
  ): SelectQueryBuilder<Entity> {
    return attachTypedHaving(this, method, aggregate, selection, conditions, parameters, options);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    havingTyped: createHavingMethod('having'),
    andHavingTyped: createHavingMethod('andHaving'),
    orHavingTyped: createHavingMethod('orHaving'),
  } as Partial<SelectQueryBuilder<ObjectLiteral>>,
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

const AGGREGATES: readonly TypedAggregate[] = ['COUNT', 'COUNT DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX'];

function attachTypedHaving<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  method: HavingMethods,
  aggregate: TypedAggregate,
  selection: AnySelection,
  conditions: string,
  parameters?: unknown,
  options?: TypedWhereOptions
): SelectQueryBuilder<Entity> {
  const methodName = `${method}Typed`;

  // the aggregate goes into the SQL as is
  if (!AGGREGATES.includes(aggregate)) {
    throw new TypeError(`${methodName}: the aggregate is one of ${AGGREGATES.join(', ')}, got "${String(aggregate)}"`);
  }

  let argument: string;

  if (selection === '*') {
    if (aggregate !== 'COUNT') {
      throw new TypeError(`${methodName}: only COUNT takes '*', got ${aggregate}`);
    }

    argument = '*';
  } else {
    // a path into a JSON column is cast: to a number to add it up, and for MIN / MAX to the type of the
    // value it is compared with, as in whereTyped; a count needs no cast
    const compared = isParamsObject(parameters) ? Object.values(parameters)[0] : parameters;
    const value = aggregate === 'SUM' || aggregate === 'AVG' ? 0 : aggregate === 'MIN' || aggregate === 'MAX' ? compared : undefined;

    argument = getTypedSingleColumnKey(builder, selection, methodName, { value });
  }

  const expression = aggregate === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${argument})` : `${aggregate}(${argument})`;

  return attachWhere(builder, method, expression, conditions, parameters, { addValue: options?.addValue });
}
