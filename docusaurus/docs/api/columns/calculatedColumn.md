---
sidebar_position: 1
---

# CalculatedColumn / addSelectCalculated

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

- schema sync and migrations leave it out, and it is never inserted or updated;
- TypeORM never selects it by itself: an entity loaded without `addSelectCalculated` has it `undefined`.

`addSelectCalculated(selection, property, alias?)` selects the expression under the key TypeORM reads the property from (`user_imagesCount`, shortened past the driver's alias length limit the way TypeORM does it), so `getMany()` / `getOne()` put the value into the entities. The property is checked against the entity type, and must be a `@CalculatedColumn`, otherwise it throws a `TypeError`. Hand-written `addSelect(expression, 'user_imagesCount')` aliases break silently on a typo, a renamed property or a long alias.

### Compared with `@VirtualColumn`

TypeORM's `@VirtualColumn({ query })` has one SQL query, which runs every time the entity is loaded. A `@CalculatedColumn` costs nothing until a query asks for it, and each query chooses the expression.

### Types

The selected value is converted by the column's type, as for `@Column`:

- by default the property's TypeScript type, with `emitDecoratorMetadata`: `number`, `string`, `boolean`, `Date`. A `number` also turns PostgreSQL's bigint strings into numbers, so a `COUNT(*)` comes back as a number;
- `@CalculatedColumn('jsonb')`, `@CalculatedColumn({ type: 'timestamptz' })` for other types. A union type (`string | null`) is reflected as `Object`: give it a type;
- `@CalculatedColumn({ type: 'varchar', transformer: { from: (value) => …, to: (value) => value } })` converts further, e.g. JSON text from SQLite.

### Limits

- The value is read when the entity is **selected as a whole**: the alias, as `createQueryBuilder('user')`, `leftJoinAndSelect` and `getMany()` do. With `select(['user.id', 'user.name'])` it isn't put into the entity.
- To **order** by it, order by the expression: `orderBy('(SELECT COUNT(*) …)', 'DESC')`.
- `find()` options can't select it.

## Signature

```typescript
@CalculatedColumn(type?: ColumnType)
@CalculatedColumn(options?: { type?: ColumnType; transformer?: ValueTransformer | ValueTransformer[] })

addSelectCalculated(selection: string | ((qb) => SelectQueryBuilder), property: keyof Entity): this
addSelectCalculated(selection: string | ((qb) => SelectQueryBuilder), property: string, alias: string): this
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
