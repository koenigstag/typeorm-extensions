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
  nulls?: 'first' | 'last' | 'FIRST' | 'LAST';
  isReversed?: boolean;
  tableAlias?: string;
};
```

- `field`: entity property to order by.
- `direction`: `'asc'` / `'desc'` in any case; `1` is `ASC`, `-1` is `DESC`; `true` is `ASC`, `false` is `DESC`.
- `nulls`: `NULLS FIRST` / `NULLS LAST`.
- `isReversed`: used only when `direction` is not set: `true` is `DESC`, `false` is `ASC`.
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
