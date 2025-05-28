---
sidebar_position: 4
---

# interface OrderFilter

## Description

`OrderFilter<Entity>` is an order interface which you can use in your filters.

## Definition

```typescript
interface OrderFilter<Entity> {
  orderBy?: Array<OrderParam<Entity>>;
}
```

## Example

```typescript
class UsersFilter implements OrderFilter<UserEntity> {
  orderBy: Array<OrderParam<UserEntity>> =
  [{ field: 'createdAt', direction: 'asc', nulls: 'last' }];
}
```