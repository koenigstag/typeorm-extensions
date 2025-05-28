---
sidebar_position: 5
---

# type OrderParam

## Description

`OrderParam<Entity>` is a type that represents an order configuration.

## Definition

Defaults:
- `direction = 'asc'`
- `nulls = undefined`

```typescript
type OrderParam<Entity> = {
  field: NonFunctionPropertyNames<Entity>;
  direction?: 'asc' | 'desc' | 'ASC' | 'DESC' | 1 | -1;
  nulls?: 'first' | 'last' | 'FIRST' | 'LAST';
};
```

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
```