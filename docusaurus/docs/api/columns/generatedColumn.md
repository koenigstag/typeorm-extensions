---
sidebar_position: 2
---

# GeneratedColumn

## Description

A column of the table that the database computes: `GENERATED ALWAYS AS (…) STORED`. TypeORM reads it like any other column and never writes it.

```typescript
import { GeneratedColumn } from 'typeorm-extensions/helpers';

@Entity('line_items')
export class LineItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'integer' })
  quantity: number;

  @GeneratedColumn({ type: 'integer', asExpression: 'price * quantity', generatedType: 'STORED' })
  total: number;
}
```

A plain `@Column` over a generated column writes it whenever the entity holds a value: a loaded entity saved as a copy, a value set in code, an `update().set()` that names it. The database rejects that (PostgreSQL: `cannot insert a non-DEFAULT value into column "total"`). `asExpression` doesn't change it, in TypeORM 0.3 or 1.x: it only describes the column for schema sync. `@GeneratedColumn()` is `@Column()` with `insert: false` and `update: false`, so whatever the entity holds is never sent.

- `asExpression` and `generatedType: 'STORED'` are needed when TypeORM creates the schema (synchronize, generated migrations). A column created by a hand-written migration needs neither.
- Every other `@Column` option applies: `select: false` keeps the column out of plain loads, `name` maps a property to another column name.
- `insert`, `update` and `readonly` are not options: `readonly: false` would turn updates back on in TypeORM 0.3, so the decorator drops it.

It is exported from the package root and from the side-effect-free `typeorm-extensions/helpers`.

## Generated, calculated or virtual

Three ways to give an entity a value it doesn't write itself:

| | `@GeneratedColumn` | [`@CalculatedColumn`](./calculatedColumn.md) | TypeORM's `@VirtualColumn` |
|---|---|---|---|
| Column of the table | yes, stored by the database | no | no |
| Computed | by the database, on every write of the row | by the query that selects it, with `addSelectCalculated` | by TypeORM's one `query`, on every load |
| Cost of a plain load | reading a stored column | nothing: it isn't selected | a subquery per row |
| Same value in every query | yes | no, each query picks its expression | yes |
| `where`, `orderBy`, typed methods, `find()` | yes, as any column | through the expression, or `orderByCalculated` | the subquery, by hand |
| Index | yes | no | no |
| Written by TypeORM | never | never | never |

## Use cases

### A value of the row itself: `@GeneratedColumn`

The total of an order line depends only on its own columns. Stored and indexed, it can be filtered and sorted like any column, and no code path can save a stale one.

```typescript
@Entity('line_items')
export class LineItemEntity {
  @Column({ type: 'integer' }) price: number;
  @Column({ type: 'integer' }) quantity: number;

  @GeneratedColumn({ type: 'integer', asExpression: 'price * quantity', generatedType: 'STORED' })
  total: number;
}

lineItemRepository.find({ where: { total: MoreThan(100) }, order: { total: 'DESC' } });
```

### A value that depends on the query: `@CalculatedColumn`

How many images a user has is a count over another table, and only some screens need it. With `@CalculatedColumn` the list that shows it pays for it, and every other load of a user doesn't.

```typescript
@Entity('users')
export class UserEntity {
  @CalculatedColumn()
  imagesCount?: number;
}

userRepository
  .createQueryBuilder('user')
  .addSelectCalculated('(SELECT COUNT(*) FROM "images" "i" WHERE "i"."userId" = "user"."id")', 'imagesCount')
  .orderByCalculated('imagesCount', 'DESC')
  .getMany();
```

### A cheap value every load needs: `@VirtualColumn`

A label built from the row and a lookup, needed wherever the entity appears, small enough to compute every time. `@VirtualColumn` keeps the SQL in one place; every query that loads the entity runs it.

```typescript
@Entity('events')
export class EventEntity {
  @VirtualColumn({
    query: (alias) => `SELECT "c"."name" FROM "categories" "c" WHERE "c"."id" = ${alias}."categoryId"`,
  })
  categoryName: string;
}
```

## Signature

```typescript
@GeneratedColumn(options?: GeneratedColumnOptions)
@GeneratedColumn(type: ColumnType, options?: GeneratedColumnOptions)

type GeneratedColumnOptions = Omit<ColumnOptions, 'insert' | 'update' | 'readonly'>;
```
