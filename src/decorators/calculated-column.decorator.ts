import { ColumnType, getMetadataArgsStorage, ValueTransformer } from 'typeorm';

export type CalculatedColumnOptions = {
  /**
   * The type the selected value is converted from, as for `@Column`: `'boolean'`, `'jsonb'`, `'timestamptz'`.
   * Defaults to the property's TypeScript type with `emitDecoratorMetadata`: `Number`, `String`, `Boolean`, `Date`.
   * `Number` also turns PostgreSQL's bigint strings (a `COUNT`) into numbers.
   */
  type?: ColumnType;
  /** Converts the selected value, e.g. JSON text from SQLite. Only `from` is used. */
  transformer?: ValueTransformer | ValueTransformer[];
};

/**
 * A property that a query fills with an SQL expression of its own, through `addSelectCalculated`:
 * a count, a latest date, a flag. It is no column of the table: schema sync leaves it out, it is
 * never inserted or updated, and an entity loaded without `addSelectCalculated` doesn't have it.
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

    // the mode of TypeORM's @VirtualColumn: not a column of the table, never inserted or updated;
    // with no `query` and `select: false` TypeORM never selects it by itself
    getMetadataArgsStorage().columns.push({
      target: object.constructor,
      propertyName: String(propertyName),
      mode: 'virtual-property',
      options: {
        type,
        select: false,
        insert: false,
        update: false,
        transformer: options.transformer,
      },
    });
  };
}
