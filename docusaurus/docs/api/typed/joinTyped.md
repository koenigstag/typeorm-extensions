---
sidebar_position: 3
---

# joinTyped

## Description
`joinTyped` methods apply typesafe joins of entity relations to a query: `leftJoinTyped`, `innerJoinTyped`, `leftJoinAndSelectTyped` and `innerJoinAndSelectTyped`. The callback may only select relation properties.

The map joins `leftJoinAndMapOneTyped`, `innerJoinAndMapOneTyped`, `leftJoinAndMapManyTyped` and `innerJoinAndMapManyTyped` pick the property that receives the joined data with a callback, see [Map joins](#map-joins).

## Signature
```typescript
leftJoinTyped(
  selection: (proxy: Entity) => relation,
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
): SelectQueryBuilder<Entity>

innerJoinTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
leftJoinAndSelectTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
innerJoinAndSelectTyped(selection, alias, condition?, parameters?): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects a relation of entity.
- alias: string: Alias of the joined relation. Use the relation's property name (e.g. `'images'` for `user.images`) to reference its columns with typed methods as `user => user.images.url`. For any other alias, type the callbacks by the query's aliases, see [Typing joined aliases](./types/KeyProxyCallback.md#typing-joined-aliases).
- condition?: string: Additional join condition.
- parameters?: ObjectLiteral: Parameters for the condition.

## Usage

```typescript
// same as `query.leftJoin('user.subscriptions', 'subscriptions')`
query.leftJoinTyped(user => user.subscriptions, 'subscriptions')
```

```typescript
// same as `query.innerJoinAndSelect('user.images', 'images', 'images.url IS NOT NULL')`
query.innerJoinAndSelectTyped(user => user.images, 'images', 'images.url IS NOT NULL')
```

## Map joins

`leftJoinAndMapOneTyped`, `innerJoinAndMapOneTyped`, `leftJoinAndMapManyTyped` and `innerJoinAndMapManyTyped` are TypeORM's `leftJoinAndMapOne`, `innerJoinAndMapOne`, `leftJoinAndMapMany` and `innerJoinAndMapMany`, with the property to map to picked by a callback instead of an `'alias.property'` string. The `One` methods map a single row to the property, the `Many` methods an array of rows.

### Signature
```typescript
leftJoinAndMapOneTyped(
  mapToProperty: (proxy: Entity) => property,
  entity: Function | string | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
  alias: string,
  condition?: string,
  parameters?: ObjectLiteral
): this

innerJoinAndMapOneTyped(mapToProperty, entity, alias, condition?, parameters?): this
leftJoinAndMapManyTyped(mapToProperty, entity, alias, condition?, parameters?): this
innerJoinAndMapManyTyped(mapToProperty, entity, alias, condition?, parameters?): this
```

### Arguments
- mapToProperty: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The property that receives the joined data. Any property of the root, not only a relation: a property declared on the entity for the mapped data works too. `user => user.profile` is `'user.profile'`, on the query's main alias. With an alias-keyed root, from [`typed<Root>()`](./typed.md) or a type argument, `q => q.photo.owner` is `'photo.owner'`, a property of an alias joined before.
- entity: The joined data, as TypeORM's methods take it: an entity class or name, a relation (`'user.photos'`), a table name, or a factory that builds a subquery on the query builder it is given.
- alias: string: Alias of the joined data.
- condition?: string: Join condition.
- parameters?: ObjectLiteral: Parameters for the condition.

The `mapAsEntity` argument that TypeORM's `leftJoinAndMapOne` and `innerJoinAndMapOne` take after `parameters` for a subquery in newer versions isn't passed on: use TypeORM's own method for it.

### Usage

```typescript
// same as `query.leftJoinAndMapOne('user.profile', ProfileEntity, 'profile', 'profile.userId = user.id')`
query.leftJoinAndMapOneTyped(user => user.profile, ProfileEntity, 'profile', 'profile.userId = user.id')
```

```typescript
type Joins = { user: UserEntity; photo: PhotoEntity };

// same as `.leftJoinAndMapMany('photo.likes', LikeEntity, 'like', 'like.photoId = photo.id')`
query
  .leftJoinAndSelect('user.photos', 'photo')
  .typed<Joins>()
  .leftJoinAndMapManyTyped(q => q.photo.likes, LikeEntity, 'like', 'like.photoId = photo.id')
```
