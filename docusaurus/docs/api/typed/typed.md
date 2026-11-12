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
- **The root carries through the chain**, TypeORM's own methods and this library's included (`.andWhere(…)`, `.leftJoin(…)`, `.selectTyped(…)`), and `getMany()` still returns the builder's entities.
- **With `strictParams`**, the parameters of these calls are checked against the columns. An explicit type argument (`whereTyped<Joins>(…)`) turns that check off, since TypeScript can't infer the other type arguments when one is given; `typed<Joins>()` leaves no type argument on the calls.
- An explicit root on a call still wins over the one set with `typed()`.
- **`from()` and `addFrom()` keep the root**, so it may go before them: `dataSource.createQueryBuilder().typed<Joins>().from(CheckIn, 'checkin')` is a builder of `CheckIn` whose typed calls take `Joins`, as `.from(CheckIn, 'checkin').typed<Joins>()` is. The root names the aliases of the query, which a FROM doesn't change. A subquery (`subQuery()`, the factory of `from((sub) => …)`) is a query of its own and starts without it, and so do the builders that `insert()`, `update()`, `delete()`, `softDelete()` and `restore()` return.
- A second call replaces the root; it doesn't merge the two.

The root keys are the aliases of the query (the main one included) and their entities: `{ checkin: CheckIn; event: Event }` for `createQueryBuilder('checkin')` joined with `event`. To keep the main entity's properties at the top too, pass `typed<CheckIn & { event: Event }>()`.

## Signature

```typescript
typed<Root extends ObjectLiteral>(): WithTypedRoot<SelectQueryBuilder<Entity>, Root>
```

`WithTypedRoot<SelectQueryBuilder<Entity>, Root>` is the builder with an optional `__typedRoot` method that only types carry; its entity type stays `Entity`, so it goes wherever the unmarked builder does:

- a `SelectQueryBuilder<CheckIn>` or a `SelectQueryBuilder<ObjectLiteral>` parameter;
- a helper generic over the entity, `<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>) => …`, which infers `T` as `CheckIn`. It returns a `SelectQueryBuilder<T>`, without the root; a helper that keeps it takes and returns the builder's own type, `<Q extends SelectQueryBuilder<ObjectLiteral>>(qb: Q): Q`;
- a cast that compiles on the unmarked builder, such as `dataSource.createQueryBuilder().typed<Joins>()… as SelectQueryBuilder<Row>` for a query of raw rows. A builder of an entity doesn't cast to an unrelated `SelectQueryBuilder<Row>`, marked or not.

A helper generic over the entity can set a root itself: `qb.typed<Joins>()` on a `SelectQueryBuilder<T>` is a `SelectQueryBuilder<T>`, and its typed calls take `Joins`. `WithTypedRoot` is exported for helpers that take a marked builder, `(qb: WithTypedRoot<SelectQueryBuilder<CheckIn>, Joins>) => …`, and `TypedRoot<Entity, Builder>` reads the root back. A builder of a marked entity, `SelectQueryBuilder<WithTypedRoot<CheckIn, Joins>>`, takes the root too. On a builder without an entity type (`SelectQueryBuilder<any>`, from `dataSource.createQueryBuilder()`), `typed()` sets the root too, and declaration files (`declaration: true`) name a marked builder by `WithTypedRoot`.
