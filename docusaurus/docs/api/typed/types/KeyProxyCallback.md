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

`DeepUnwrapArray<Entity>` is the entity type with array relations unwrapped and optional properties made required, so `user.images.url` type-checks when `images` is `ImageEntity[] | undefined`. A property marked with [`Json<T>`](../whereTyped.md#paths-into-json-columns) is open at any depth.

## How keys are built

| Callback | Key |
|---|---|
| `user => user.name` | `user.name`: a column of the query's main entity is prefixed with the query alias |
| `user => user.images.url` | `images.url`: a column of a relation uses the relation name as the alias (the query must have that alias) |
| `person => person.address.city` | `person.address.city`: an embedded column of the main entity (the first key isn't a query alias, and the entity has a column with that path) |
| `exec => exec.details.meta.endTs` | `"exec"."details" -> 'meta' ->> 'endTs'`: the keys after a JSON column are a path inside it, in where methods only (see [Paths into JSON columns](../whereTyped.md#paths-into-json-columns)) |
| `user => [user.id, user.name]` | `['user.id', 'user.name']`: several keys (for `selectTyped`, `distinctOnTyped`, `groupByTyped`) |

The property is mapped to its database column (`@Column({ name })`, embedded columns) through the metadata of its alias: where methods and `useQuotes` emit the quoted column, e.g. `"user"."created_at"`.

A relation column is keyed by the relation property name, so join the relation with that alias:

```typescript
query
  .leftJoinTyped(user => user.images, 'images') // alias = property name
  .andWhereTyped(user => user.images.url, 'IS NOT NULL')
  .orderByTyped(user => user.images.url, 'ASC')
```

Paths are limited to two levels, `column` or `alias.column`: `user => user.images.user.email` is a compile error (the second level of a nested relation is a `KeyPathEnd`, which can be selected as a whole but not dereferenced) and throws a `TypeError` at runtime. For columns of nested relations, join them and address the join alias with an alias-keyed type, see [Typing joined aliases](#typing-joined-aliases). For a foreign key, use its property (`user => user.images.userId`).

JSON columns are the exception. In where methods the keys after a JSON column become a JSON path: `user => user.metadata.role` works with any JSON column, and a column marked with [`Json<T>`](../whereTyped.md#paths-into-json-columns) goes deeper (`exec => exec.details.meta.endTs`). Select, order, distinct and group by take columns only and throw a `TypeError` for a path into a JSON column.


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

## Before `from()`

A query created without an entity (`dataSource.createQueryBuilder()`, `manager.createQueryBuilder()`, `qb.subQuery()`) has no main alias until `from()`. Address columns by their alias there: `alias.column` keys don't need the main alias.

```typescript
type Base = { base: ChatMessage };

// SELECT "base"."chatRoomId" FROM "chat_messages" "base"
dataSource
  .createQueryBuilder()
  .selectTyped<Base>((q) => q.base.chatRoomId)
  .from(ChatMessage, 'base')
```

```typescript
query.where((qb) => {
  const subQuery = qb
    .subQuery()
    .selectTyped<{ m: ChatMessage }>((q) => q.m.chatRoomId)
    .from(ChatMessage, 'm')
    .getQuery();

  return `"room"."id" IN ${subQuery}`;
})
```

A single-level key (`(q) => q.chatRoomId`) needs the main alias, so before `from()` it throws a `TypeError`. Column names are mapped through aliases the query already knows: a quoted key (where methods, `useQuotes`) for a renamed column needs `from()` to come first.

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
