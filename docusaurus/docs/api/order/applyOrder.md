---
sidebar_position: 2
---

# applyOrder

## Description

`applyOrder` is a method that applies order to a query.

## Signature

```typescript
applyOrder(
  orderBy: OrderParam<Entity>,
  orderOptions?: ApplyOrderOptions
): SelectQueryBuilder<Entity>
```

## Arguments

- orderBy: [OrderParam&lt;Entity&gt;](../types/OrderParam): The order to apply to the query.
- orderOptions?: [ApplyOrderOptions](../types/ApplyOrderOptions): Additional options to apply to the order filter.

A `field` that is a [`@CalculatedColumn`](../columns/calculatedColumn.md#ordering) of the alias (`tableAlias`, `alias`, or the main one) is ordered by its value, as [`orderByCalculated`](../columns/calculatedColumn.md#ordering) does; select it with `addSelectCalculated` first, or it throws a `TypeError`.

## Usage

```typescript
query.applyOrder({ field: 'name', direction: 'asc', nulls: 'last' }, { useQuotes: true })
```