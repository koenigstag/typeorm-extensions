---
sidebar_position: 6.8
---

# havingTyped

## Description
`havingTyped` sets a HAVING condition on an aggregate of an entity property: `havingTyped('COUNT', user => user.images.id, '>=', 2)` gives `HAVING COUNT("images"."id") >= :having_…`. `andHavingTyped` and `orHavingTyped` add to it.

## Signature
```typescript
havingTyped(
  aggregate: 'COUNT' | 'COUNT DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX',
  selection: KeyProxyCallback<Entity> | '*',
  condition: string,
  params?: unknown,
  options?: { addValue?: boolean }
): SelectQueryBuilder<Entity>

andHavingTyped(aggregate, selection, condition, params?, options?): SelectQueryBuilder<Entity>
orHavingTyped(aggregate, selection, condition, params?, options?): SelectQueryBuilder<Entity>
```

## Arguments
- aggregate: the aggregate function. `'COUNT DISTINCT'` is `COUNT(DISTINCT column)`. Anything else throws a `TypeError`: it goes into the SQL.
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md) of one column, or `'*'` for `COUNT(*)`, every row of the group (only with `'COUNT'`). The callback starts at the entity, or at the root set with `typed<Root>()`. Columns of joined relations work, and paths into JSON columns as in [whereTyped](./whereTyped.md#paths-into-json-columns): cast to a number for `SUM` / `AVG`, and for `MIN` / `MAX` to the type of the value they are compared with.
- condition, params, options: as in [whereTyped](./whereTyped.md): the value gets a placeholder of its own unless the condition names a key of `params`.

With [`strictParams`](./whereTyped.md#checking-parameters-strictparams) the value is checked: a number for `COUNT`, `COUNT DISTINCT`, `SUM` and `AVG`, the column's value for `MIN` and `MAX`.

Like TypeORM's `having`, `havingTyped` replaces previously set HAVING conditions.

## Usage

```typescript
// same as `query.having('COUNT(images.id) >= :count', { count: 2 })`
query
  .leftJoin('user.images', 'images')
  .groupBy('user.id')
  .havingTyped('COUNT', user => user.images.id, '>=', 2)
```

```typescript
// HAVING COUNT(*) > :having_… AND MAX("order"."createdAt") < :having_…
query
  .havingTyped('COUNT', '*', '>', 5)
  .andHavingTyped('MAX', order => order.createdAt, '<', since)
```

```typescript
// HAVING COUNT(DISTINCT "ticket"."userId") = :groupSize
query.havingTyped('COUNT DISTINCT', ticket => ticket.userId, '= :groupSize', { groupSize: userIds.length })
```
