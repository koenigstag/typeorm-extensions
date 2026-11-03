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

Only the first two levels of a path are used: `user => user.images.user.email` becomes `images.user`. For columns of nested relations, join them and address the join alias with an alias-keyed type, see [Typing joined aliases](#typing-joined-aliases).


## Typing joined aliases

When a join's alias isn't the relation's property name, or the join isn't a relation at all (`innerJoin(ImageEntity, 'img', …)`, a subquery), type the callback by the query's aliases instead of the entity. Use a type whose keys are the aliases and whose values are their entities. The first level of the path is then the alias and the second one the column:

```typescript
// keys = query aliases, values = their entities
type Joins = { user: UserEntity; img: ImageEntity };

const user = tableHelper<UserEntity>('user');
const img = tableHelper<ImageEntity>('img');

query
  .innerJoin(ImageEntity, 'img', user.joinOn('id', `= ${img.column('userId')}`))
  .selectTyped<Joins>(j => [j.user.id, j.user.firstName, j.img.url])
  .whereTyped<Joins>(j => j.img.url, 'LIKE', '%.png')
  .andWhereIsInTyped<Joins>(j => j.user.firstName, ['Alice', 'Bob'])
  .orderByTyped<Joins>(j => j.img.url, 'DESC')
// SELECT "user"."id" AS "user_id", "user"."firstName" AS "user_firstName", "img"."url" AS "img_url"
// FROM "users" "user" INNER JOIN "images" "img" ON "user"."id" = "img"."userId"
// WHERE "img"."url" LIKE :where_xxxxx AND "user"."firstName" IN (:...andWhere_xxxxx)
// ORDER BY "img_url" DESC
```

- Always select two levels (`j.img.url`). A single level (`j => j.img`) is treated as a column of the main entity and gets the main alias: `user.img`.
- The main alias works the same way (`j.user.id`), so one `Joins` type covers the whole query.
- A typo in an alias or a column (`j.img.uri`) is a compile error.
- For string parts of the query, `tableHelper<Joins['img']>('img')` gives the matching helper.

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
