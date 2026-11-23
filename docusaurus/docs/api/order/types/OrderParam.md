---
sidebar_position: 5
---

# type OrderParam

## Description

`OrderParam<Entity>` is a type that represents an order configuration.

## Definition

Defaults:
- `direction = 'ASC'`
- `nulls = undefined` (database default)

```typescript
type OrderParam<Entity> = {
  field: NonFunctionPropertyNames<Required<Entity>>;
  direction?: 'asc' | 'desc' | 'ASC' | 'DESC' | 1 | -1 | true | false;
  nulls?: 'first' | 'last' | 'FIRST' | 'LAST' | 'NULLS FIRST' | 'NULLS LAST' | 'nulls first' | 'nulls last';
  isReversed?: boolean;
  tableAlias?: string;
};
```

- `field`: entity property to order by.
- `direction`: `'asc'` / `'desc'` in any case; `1` is `ASC`, `-1` is `DESC`; `true` is `ASC`, `false` is `DESC`. The same values as query-string text (`'-1'`, `'false'`) work too, as an unparsed query parameter holds them. Anything else is `ASC`.
- `nulls`: `NULLS FIRST` / `NULLS LAST`, given as `first` / `last` or in the SQL form, in any case and with spaces around. Any other value adds no `NULLS`. MySQL and MariaDB have no `NULLS`: there `(column) IS NULL` is selected under a generated `nulls_…` alias and ordered by first, so raw rows carry that column.
- `isReversed`: used only when `direction` is not set: `true` and `1` are `DESC`, `false` and `0` are `ASC`, also as query-string text (`'true'`, `'1'`, `'false'`, `'0'`).
- `tableAlias`: alias to prefix the field with, e.g. a joined relation's alias. Takes precedence over `ApplyOrderOptions.alias`.

## Example

```typescript
@Entity()
class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}

const orderBy: OrderParam<UserEntity> = { field: 'createdAt', direction: 'asc', nulls: 'last' };

// newest first
const newest: OrderParam<UserEntity> = { field: 'createdAt', isReversed: true };
```

```typescript
// order by a column of a joined relation
query
  .leftJoin('user.images', 'images')
  .applyOrder<ImageEntity>({ field: 'url', direction: 'desc', tableAlias: 'images' });
```
