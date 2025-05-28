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

## Usage

```typescript
query.applyOrder({ field: 'name', direction: 'asc', nulls: 'last' }, { useDoubleQuotes: true })
```