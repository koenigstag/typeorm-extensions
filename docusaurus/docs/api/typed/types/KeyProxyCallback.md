---
sidebar_position: 1
---

# type KeyProxyCallback

## Description

`KeyProxyCallback<Entity>` is the callback that typed methods take instead of a column string. It receives a proxy of the entity and returns the properties it accesses. The proxy only records the property path, it never reads values. The path is turned into an SQL key, so a typo or a renamed property becomes a compile error instead of a broken query.

## Definition

```typescript
type KeyProxyCallback<Entity> = (
  proxy: DeepUnwrapArray<Entity>
) => ProxyColumnValueType | Array<ProxyColumnValueType>;
```

`DeepUnwrapArray<Entity>` is the entity type with array relations unwrapped and optional properties made required, so `user.images.url` type-checks when `images` is `ImageEntity[] | undefined`.

## How keys are built

| Callback | Key |
|---|---|
| `user => user.name` | `user.name`: a column of the query's main entity is prefixed with the query alias |
| `user => user.images.url` | `images.url`: a column of a relation uses the relation name as the alias |
| `user => [user.id, user.name]` | `['user.id', 'user.name']`: several keys (for `selectTyped`, `distinctOnTyped`) |

A relation column is keyed by the relation property name, so join the relation with that alias:

```typescript
query
  .leftJoinTyped(user => user.images, 'images') // alias = property name
  .andWhereTyped(user => user.images.url, 'IS NOT NULL')
  .orderByTyped(user => user.images.url, 'ASC')
```

Only the first two levels of a path are used: `user => user.images.user.email` becomes `images.user`. For columns of nested relations, pass a string key with the join alias instead.

## Example

```typescript
@Entity()
class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => ImageEntity, (image) => image.user)
  images?: ImageEntity[];
}

query
  .leftJoinTyped(user => user.images, 'images')
  .selectTyped(user => [user.id, user.name, user.images.url])
  .whereTyped(user => user.name, 'LIKE', '%John%')
```
