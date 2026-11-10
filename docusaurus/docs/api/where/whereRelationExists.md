---
sidebar_position: 8.5
---

# whereRelationExists / whereRelationNotExists

## Description

`EXISTS` / `NOT EXISTS` over a relation of an entity, with the join condition taken from the relation's metadata. A hand-written correlated subquery repeats the join (`"image"."userId" = "user"."id"`) and breaks silently when a column is renamed; here the relation is picked by a typed callback.

```typescript
// users with an image that is not hidden
userRepository
  .createQueryBuilder('user')
  .andWhereRelationExists(
    user => user.images,
    'image',
    images => images.andWhereTyped(image => image.hidden, '=', false)
  )
```

```sql
WHERE EXISTS (
  SELECT 1 FROM "images" "image"
  WHERE "image"."hidden" = :andWhere_x1Fq2 AND "image"."userId" = "user"."id"
)
```

- **Relations:** one-to-many and many-to-one, one-to-one from either side, and many-to-many from either side, through its junction table (`INNER JOIN` of the junction in the subquery).
- **The callback** gets the subquery, a `SelectQueryBuilder` of the related entity with `alias` as its main alias, so typed methods work on it. The join condition is added after the callback's conditions, wrapped so that an `orWhere` of the callback can't escape it and a `where` can't replace it.
- **Parameters** of the subquery get unique names, as in [whereNotExists](./whereNotExists.md#parameters): a `:status` inside doesn't read the value of an outer `:status`.
- **`alias`** names the related entity in the subquery. It must not be an alias of the outer query, which the join condition refers to: that throws a `TypeError`, as does a property that isn't a relation.

## Signature

```typescript
whereRelationExists(relation: (entity) => Related, alias: string, where?: (subQuery: SelectQueryBuilder<Related>) => unknown): this
andWhereRelationExists(relation, alias, where?): this
orWhereRelationExists(relation, alias, where?): this

whereRelationNotExists(relation, alias, where?): this
andWhereRelationNotExists(relation, alias, where?): this
orWhereRelationNotExists(relation, alias, where?): this
```

`whereRelationExists` / `whereRelationNotExists` replace the WHERE conditions set before, like `where`. On `SelectQueryBuilder`.

## Usage

```typescript
// a relation of a joined entity: name the root type, as with other typed methods, and the related
// entity, which the callback can't give past `alias.relation`
type Joins = { user: UserEntity; community: CommunityEntity };

query
  .leftJoin('user.community', 'community')
  .andWhereRelationExists<InterestEntity, Joins>(joins => joins.community.interests, 'interest')
```

```typescript
// members who are in no group: NOT EXISTS through the junction table
memberRepository
  .createQueryBuilder('member')
  .andWhereRelationNotExists(member => member.groups, 'grp')
```
