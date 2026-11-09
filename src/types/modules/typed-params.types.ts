import type { TypeormExtensionsConfig } from '../interfaces/config.interface';
import type { TypedWhereOptions } from '../extensions/typed-where.types';
import type { ArgsType } from '../util-types';

declare const unsetType: unique symbol;

/**
 * Default of the `Type` argument of typed methods. Tells a call without a type argument, whose proxy is
 * typed by the query builder's entity, from an explicit `whereTyped<Joins>(…)`.
 */
export interface UnsetType {
  readonly [unsetType]: true;
}

/** Blocks inference from this position, so the column type comes from the callback alone (`NoInfer` before TypeScript 5.4). */
type NoInferType<T> = [T][T extends unknown ? 0 : never];

/** Whether `Type` was left out; an explicit `<any>` is assignable to `UnsetType` but was given. */
type IsUnset<Type> = 0 extends 1 & Type ? false : [Type] extends [UnsetType] ? true : false;

export type TypeOrDefault<Type, Default> = IsUnset<Type> extends true ? Default : Type;

type IsStrict<Type> = TypeormExtensionsConfig extends { strictParams: true } ? IsUnset<Type> : false;

/** A column's value as a parameter: never `null` / `undefined` (they turn `= :value` into `= NULL`); a date may be a string. */
export type ParamValue<Value> = NonNullable<Value> extends Date ? Date | string : NonNullable<Value>;

type IsValueObject<P> = [P] extends [Date | ArrayBufferView | ArrayBuffer | readonly unknown[]] ? true : false;

/**
 * The value itself, or a `{ name: value }` params object. A plain object value (a JSON column) can only be
 * passed in a params object: at runtime a plain object always is one.
 */
type DirectOrField<P> = [P] extends [object]
  ? IsValueObject<P> extends true
    ? P | Readonly<Record<string, P>>
    : Readonly<Record<string, P>>
  : P | Readonly<Record<string, P>>;

type Trim<S extends string> = S extends ` ${infer Rest}` ? Trim<Rest> : S extends `${infer Rest} ` ? Trim<Rest> : S;

type NoValueOperator =
  | 'IS NULL'
  | 'IS NOT NULL'
  | 'IS TRUE'
  | 'IS NOT TRUE'
  | 'IS FALSE'
  | 'IS NOT FALSE'
  | 'IS UNKNOWN'
  | 'IS NOT UNKNOWN';
type ComparisonOperator = '=' | '!=' | '<>' | '>' | '<' | '>=' | '<=';
type DistinctOperator = 'IS DISTINCT FROM' | 'IS NOT DISTINCT FROM';
type NullOperator = 'IS' | 'IS NOT';
type ListOperator = 'IN' | 'NOT IN';
type PatternOperator = 'LIKE' | 'NOT LIKE' | 'ILIKE' | 'NOT ILIKE';

type LooseWhereArgs = [parameters?: unknown, options?: TypedWhereOptions];
type ValueArgs<P> = [parameters: DirectOrField<P>, options?: TypedWhereOptions];

type StrictWhereArgs<Operator extends string, Value> = Uppercase<Trim<Operator>> extends infer Op
  ? Op extends NoValueOperator
    ? [parameters?: undefined, options?: TypedWhereOptions]
    : Op extends ComparisonOperator
      ? ValueArgs<ParamValue<Value>>
      : Op extends DistinctOperator
        ? ValueArgs<ParamValue<Value> | null>
        : Op extends NullOperator
          ? ValueArgs<null>
          : Op extends ListOperator
            ? ValueArgs<readonly ParamValue<Value>[]>
            : Op extends PatternOperator
              ? ValueArgs<string>
              : LooseWhereArgs
  : never;

/**
 * Parameters and options of `whereTyped`. With `strictParams` the parameter is checked against the column type
 * for the operators it knows; conditions written as SQL (`'BETWEEN :from AND :to'`, `'= true'`) aren't checked.
 */
export type TypedWhereArgs<Type, Operator extends string, Value> =
  IsStrict<Type> extends true ? StrictWhereArgs<NoInferType<Operator>, NoInferType<Value>> : LooseWhereArgs;

/** Values of `whereIsInTyped` / `whereIsAnyTyped`; with `strictParams`, of the column's type. */
export type TypedArrayArg<Type, Value> = IsStrict<Type> extends true ? readonly ParamValue<NoInferType<Value>>[] : ArgsType;
