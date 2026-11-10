---
sidebar_position: 1.5
---

# typed

## Description

Sets the root of the typed callbacks once for the whole query, instead of passing it to each call.

A typed callback starts at the query's entity: `whereTyped(u => u.email, …)`. To reach the aliases of a query whose tables are joined without a relation, or raw tables, the root is usually passed to every call:

```typescript
type Joins = { checkin: CheckIn; event: Event };

query
  .selectTyped<Joins>((q) => q.checkin.customerId, 'customerId')
  .whereTyped<Joins>((q) => q.checkin.communityId, '=', communityId)
  .andWhereTyped<Joins>((q) => q.event.eventType, '=', type);
```

`typed<Root>()` sets it for every typed call that follows:

```typescript
query
  .typed<Joins>()
  .selectTyped((q) => q.checkin.customerId, 'customerId')
  .whereTyped((q) => q.checkin.communityId, '=', communityId)
  .andWhereTyped((q) => q.event.eventType, '=', type);
```

- **Type-only.** It returns the builder itself; the SQL is the same as with the explicit roots.
- **The root carries through the chain**, TypeORM's own methods included (`.andWhere(…)`, `.leftJoin(…)`), and `getMany()` still returns the builder's entities.
- **With `strictParams`**, the parameters of these calls are checked against the columns. An explicit type argument (`whereTyped<Joins>(…)`) turns that check off, since TypeScript can't infer the other type arguments when one is given; `typed<Joins>()` leaves no type argument on the calls.
- An explicit root on a call still wins over the one set with `typed()`.
- Call it once: a second call merges the two roots.

The root keys are the aliases of the query (the main one included) and their entities: `{ checkin: CheckIn; event: Event }` for `createQueryBuilder('checkin')` joined with `event`. To keep the main entity's properties at the top too, pass `typed<CheckIn & { event: Event }>()`.

## Signature

```typescript
typed<Root extends ObjectLiteral>(): SelectQueryBuilder<WithTypedRoot<Entity, Root>>
```

`WithTypedRoot<Entity, Root>` is the entity with an optional symbol method that only types carry, left out of `{ ...entity }` copies, so declaration files (`declaration: true`) never have to name it; `TypedRoot<Entity>` reads the root back. Both are exported for helpers that take such a builder, with a concrete entity: `(qb: SelectQueryBuilder<WithTypedRoot<CheckIn, Joins>>) => …`. A helper generic over the entity, `WithTypedRoot<E, Joins>`, can't use the root: TypeScript can't work it out while `E` is open. On a builder without an entity type (`SelectQueryBuilder<any>`, from `dataSource.createQueryBuilder()`), `typed()` sets the root too.
