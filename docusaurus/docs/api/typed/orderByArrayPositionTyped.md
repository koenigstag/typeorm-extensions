---
sidebar_position: 6.5
---

# orderByArrayPositionTyped

## Description
`orderByArrayPositionTyped` / `addOrderByArrayPositionTyped` order rows by the position of an entity property's value in an array. They work like [orderByArrayPosition](../order/orderByArrayPosition.md): `array_position(:values, column)`, rows not in the array last, usable with `take` and joins.

**PostgreSQL only** (and compatible databases such as CockroachDB).

### A value inside a JSON column

A path into a JSON column (`a => a.meta.score`) is read as text and cast to the type of the values, as typed where methods do: a number is compared as a number, so a stored `3.0` takes the position of `3`. With `arrayType` the array is cast too (`'int[]'`); PostgreSQL 13+ compares `integer[]` with a `numeric` value.

## Signature
```typescript
orderByArrayPositionTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
addOrderByArrayPositionTyped(selection: KeyProxyCallback<Entity>, values: readonly unknown[], arrayType?: string): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** property. Selecting several throws a `TypeError`.
- values: readonly unknown[]: Values in the wanted order.
- arrayType?: string: Type to cast the array to, e.g. `'uuid[]'`.

## Usage

```typescript
// ORDER BY array_position($1, "product"."id") ASC NULLS LAST
query
  .whereIsAnyTyped(product => product.id, rankedIds)
  .orderByArrayPositionTyped(product => product.id, rankedIds)
```
