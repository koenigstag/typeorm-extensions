import { ColumnType, getMetadataArgsStorage, ValueTransformer } from 'typeorm';

export type CalculatedColumnOptions = {
  /**
   * The type the selected value is converted from, as for `@Column`: `'boolean'`, `'jsonb'`, `'timestamptz'`.
   * Defaults to the property's TypeScript type with `emitDecoratorMetadata`: `Number`, `String`, `Boolean`, `Date`.
   * `Number` turns numeric strings (a PostgreSQL `COUNT`, an `AVG`) into numbers, decimals kept; `Boolean`
   * reads `0` / `1`, `'0'` / `'1'` and `t` / `f` as well.
   */
  type?: ColumnType;
  /** Converts the selected value, e.g. JSON text from SQLite. Only `from` is used. */
  transformer?: ValueTransformer | ValueTransformer[];
};

/**
 * A property that a query fills with an SQL expression of its own, through `addSelectCalculated`:
 * a count, a latest date, a flag. It is no column of the table: schema sync leaves it out, `save`,
 * `insert` and `update` never write it, and an entity loaded without `addSelectCalculated` doesn't have it.
 *
 * Unlike TypeORM's `@VirtualColumn`, whose one SQL query runs whenever the entity is loaded, each
 * query chooses whether to compute it, and how.
 *
 * @example
 * \@CalculatedColumn()
 * imagesCount?: number;
 *
 * userRepository
 *   .createQueryBuilder('user')
 *   .addSelectCalculated('(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "user"."id")', 'imagesCount')
 *   .getMany(); // [{ id: 1, …, imagesCount: 2 }]
 */
export function CalculatedColumn(
  typeOrOptions?: ColumnType | CalculatedColumnOptions
): PropertyDecorator {
  return (object, propertyName) => {
    const options: CalculatedColumnOptions =
      typeof typeOrOptions === 'object' ? typeOrOptions : { type: typeOrOptions };
    const reflectedType =
      typeof Reflect === 'object' && typeof Reflect.getMetadata === 'function'
        ? Reflect.getMetadata('design:type', object, propertyName)
        : undefined;
    // a union type (`string | null`) is reflected as Object, which no driver converts from
    const type = options.type ?? (reflectedType !== Object ? reflectedType : undefined);

    if (!type) {
      throw new TypeError(
        `@CalculatedColumn() on ${object.constructor.name}.${String(propertyName)} needs a type: ` +
          `@CalculatedColumn('varchar'), or a property type of number, string, boolean or Date`
      );
    }

    const conversion = ownConversions.get(type);
    const transformers = [options.transformer ?? []].flat();

    // the mode of TypeORM's @VirtualColumn: not a column of the table, never inserted or updated;
    // with no `query` and `select: false` TypeORM never selects it by itself
    getMetadataArgsStorage().columns.push({
      target: object.constructor,
      propertyName: String(propertyName),
      mode: 'virtual-property',
      options: {
        // the drivers parseInt a Number (AVG 150.5 → 150) and read MySQL's '0' as true, so these
        // types are converted here; String is a type no driver converts. TypeORM applies `from` last to first
        type: conversion ? String : type,
        select: false,
        insert: false,
        update: false,
        transformer: conversion ? [...transformers, conversion] : options.transformer,
      },
    });
  };
}

function toNumber(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }

  const number = Number(value);

  return Number.isNaN(number) ? value : number;
}

function toBoolean(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return !['', '0', 'f', 'false'].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

const numberConversion: ValueTransformer = { from: toNumber, to: (value) => value };
const booleanConversion: ValueTransformer = { from: toBoolean, to: (value) => value };

const ownConversions = new Map<unknown, ValueTransformer>([
  [Number, numberConversion],
  [Boolean, booleanConversion],
  ['boolean', booleanConversion],
  ['bool', booleanConversion],
]);
