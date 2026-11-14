---
sidebar_position: 1
---

# CalculatedColumn / addSelectCalculated / orderByCalculated

## Description

An entity property that a query fills with an SQL expression of its own: a count, a latest date, a flag.

```typescript
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CalculatedColumn()
  imagesCount?: number;

  @CalculatedColumn('varchar')
  latestImageUrl?: string | null;
}
```

```typescript
const users = await userRepository
  .createQueryBuilder('user')
  .addSelectCalculated('(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "user"."id")', 'imagesCount')
  .getMany();

// [{ id: 1, …, imagesCount: 2 }, { id: 3, …, imagesCount: 0 }]
```

`@CalculatedColumn()` is no column of the table:

- schema sync and migrations leave it out, and `save`, `insert` and `update` never write it;
- TypeORM never selects it by itself: an entity loaded without `addSelectCalculated` has it `undefined`.

`addSelectCalculated(selection, property, alias?)` selects the expression under the key TypeORM reads the property from (`user_imagesCount`, shortened past the driver's alias length limit the way TypeORM does it), so `getMany()` / `getOne()` put the value into the entities. The property is checked against the entity type, and must be a `@CalculatedColumn`, otherwise it throws a `TypeError`. Hand-written `addSelect(expression, 'user_imagesCount')` aliases break silently on a typo, a renamed property or a long alias.

### Ordering

`orderByCalculated(property, order?, nulls?, alias?)` orders by the value of a property selected with `addSelectCalculated` before; `addOrderByCalculated` adds to the order, like `addOrderBy`. [applyOrder](../order/applyOrder.md) does the same when its `field` is a `@CalculatedColumn`, so a client sorts by `imagesCount` like by any column.

```typescript
userRepository
  .createQueryBuilder('user')
  .addSelectCalculated('(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "user"."id")', 'imagesCount')
  .leftJoinAndSelect('user.images', 'images')
  .orderByCalculated('imagesCount', 'DESC')
  .take(20)
  .getMany();
```

The value is selected a second time under a generated alias (`calculated_…`) and ordered by it, as [orderByArrayPosition](../order/orderByArrayPosition.md) does. The key the entity is read from can't be ordered by: unquoted, PostgreSQL folds it (`user_imagesCount` → `user_imagescount`), and quoted, it breaks the DISTINCT query TypeORM pages through with `take` / `skip` and joins. So:

- the database computes the expression twice per row: mind it for an expensive subquery;
- the generated alias shows up in `getRawMany()` results and in the `orderBy` of [ListWithTotals](../pagination/types/ListWithTotals.md);
- ordering by the same value again, and [distinctOnTyped](../typed/distinctOnTyped.md) on the property, reuse the alias. PostgreSQL requires DISTINCT ON to match the leading ORDER BY, so both have to name that one column, in either call order:

```typescript
userRepository
  .createQueryBuilder('user')
  .addSelectCalculatedTyped(imagesCount, (user) => user.imagesCount)
  .orderByCalculatedTyped((user) => user.imagesCount, 'DESC')
  .addOrderBy('user.id')
  .distinctOnTyped((user) => user.imagesCount) // one user per count, the lowest id
  .getMany();
```

A property that isn't selected yet, or isn't a `@CalculatedColumn`, throws a `TypeError`.

### Typed callbacks

`addSelectCalculatedTyped`, `orderByCalculatedTyped` and `addOrderByCalculatedTyped` take the property as a typed callback instead of its name: `(user) => user.imagesCount`, or `(q) => q.owner.imagesCount` for the entity of the joined alias `owner`, which the callback names, so no alias argument is needed. The callback starts at the root set with [typed&lt;Root&gt;()](../typed/typedRoot.md), else at the entity, so the property of a joined entity is checked at compile time too, where the string form takes any name. That it is a `@CalculatedColumn` is still checked when the query is built: TypeScript doesn't see decorators.

```typescript
imageRepository
  .createQueryBuilder('image')
  .leftJoinAndSelect('image.user', 'owner')
  .typed<{ image: ImageEntity; owner: UserEntity }>()
  .addSelectCalculatedTyped(
    '(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "owner"."id")',
    (q) => q.owner.imagesCount
  )
  .orderByCalculatedTyped((q) => q.owner.imagesCount, 'DESC');
```

### Compared with `@VirtualColumn`

TypeORM's `@VirtualColumn({ query })` has one SQL query, which runs every time the entity is loaded. A `@CalculatedColumn` costs nothing until a query asks for it, and each query chooses the expression. For a column the database computes and stores, see [GeneratedColumn](./generatedColumn.md), which compares the three.

### Types

The selected value is converted by the column's type, as for `@Column`:

- by default the property's TypeScript type, with `emitDecoratorMetadata`: `number`, `string`, `boolean`, `Date`;
- a `number`, and a numeric SQL type (`'integer'`, `'bigint'`, `'numeric'`, `'decimal'`, `'float'`, …), turns the numeric strings of the database into numbers, decimals kept: a PostgreSQL `COUNT(*)` comes back as `2`, an `AVG` as `1.5`, where the driver gives `'2'` and `'1.5000000000000000'`. Past `Number.MAX_SAFE_INTEGER` a number loses precision: declare such a value as `@CalculatedColumn(String)`;
- a `boolean` is `false` for `false`, `0`, `'0'`, `'f'`, `'false'`, so `EXISTS (…)` works on MySQL too, where it is a number;
- `@CalculatedColumn('jsonb')`, `@CalculatedColumn({ type: 'timestamptz' })` for other types. A union type (`number | null`) is reflected as `Object`: give it a type, `@CalculatedColumn(Number)`;
- `@CalculatedColumn({ type: 'varchar', transformer: { from: (value) => …, to: (value) => value } })` converts it yourself, e.g. JSON text from SQLite. A transformer replaces the conversions above: it gets the value as the database returned it, a PostgreSQL `COUNT(*)` as `'2'`.

### Limits

- The value is read when the entity is **selected as a whole**: the alias, as `createQueryBuilder('user')`, `leftJoinAndSelect` and `getMany()` do. With `select(['user.id', 'user.name'])` it isn't put into the entity.
- `find()` options can't select it.
- Typed methods (`whereTyped`, `orderByTyped`, …) and `getManyWithCursor` take columns of the table: for the property they throw a `TypeError`. Use the expression that fills it. Only the `…CalculatedTyped` methods above and `distinctOnTyped` take it.

### TypeORM versions

The property is a TypeORM virtual property, as `@VirtualColumn` declares one, so the limits of those in older TypeORM versions apply:

| | broken up to | fixed in |
|---|---|---|
| schema sync and migration generation don't drop the removed columns of its table: drop them by hand | 0.3.28 | 0.3.29, 1.0 |
| a LEFT JOIN without a match, with the property selected on the joined alias, gives an entity of `null` columns instead of `null` | 0.3.21 | 0.3.22 |
| `upsert` of an entity with the property set fails (`no such column: EXCLUDED.…`): unset it first | 0.3.31, the latest 0.3 | 1.0 |

## Signature

```typescript
@CalculatedColumn(type?: ColumnType)
@CalculatedColumn(options?: { type?: ColumnType; transformer?: ValueTransformer | ValueTransformer[] })

addSelectCalculated(selection: string | ((qb) => SelectQueryBuilder), property: keyof Entity): this
addSelectCalculated(selection: string | ((qb) => SelectQueryBuilder), property: string, alias: string): this

orderByCalculated(property: keyof Entity, order?: 'ASC' | 'DESC', nulls?: 'NULLS FIRST' | 'NULLS LAST'): this
orderByCalculated(property: string, order: 'ASC' | 'DESC' | undefined, nulls: 'NULLS FIRST' | 'NULLS LAST' | undefined, alias: string): this
addOrderByCalculated(…): this // the same arguments

addSelectCalculatedTyped(selection: string | ((qb) => SelectQueryBuilder), property: (root) => value): this
orderByCalculatedTyped(property: (root) => value, order?: 'ASC' | 'DESC', nulls?: 'NULLS FIRST' | 'NULLS LAST'): this
addOrderByCalculatedTyped(…): this // the same arguments
```

## Usage

```typescript
// a subquery factory, as for addSelect
userRepository
  .createQueryBuilder('user')
  .addSelectCalculated(
    (qb) => qb.select('MAX(image.url)').from(ImageEntity, 'image').where('image.userId = "user"."id"'),
    'latestImageUrl'
  );
```

```typescript
// a property of a joined entity: name its alias
imageRepository
  .createQueryBuilder('image')
  .leftJoinAndSelect('image.user', 'owner')
  .addSelectCalculated('(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "owner"."id")', 'imagesCount', 'owner');
```
