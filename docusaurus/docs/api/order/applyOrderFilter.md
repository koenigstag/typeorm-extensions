---
sidebar_position: 3
---

# applyOrderFilter

## Description

`applyOrderFilter` is a method that applies a set of orders to a query.

## Signature

```typescript
applyOrderFilter(
  orderFilter: OrderFilter<Entity>,
  orderOptions?: ApplyOrderOptions
): SelectQueryBuilder<Entity>
```

## Arguments

- `orderFilter: OrderFilter<Entity>`: The order options to apply to the query. A missing filter or `orderBy` adds no order.
  - `orderBy: Array<OrderParam>`: Order configurations. One `OrderParam` given as an object is read as a list of one, as a query string parses `?orderBy[field]=id`; an order without a string `field` throws a `TypeError`.
- `orderOptions?: ApplyOrderOptions`: Additional options to apply to the order filter.
  - `useQuotes?: boolean`: How the field reaches the ORDER BY, see [ApplyOrderOptions](./types/ApplyOrderOptions).
  - `resetPreviousOrder?: boolean`: Whether to reset previous orders (defaults to false).
  - `alias?: atring`: The alias to use for the order fields.
  - `alwaysAliasFields?: string[]`: Fields that should always be aliased. Uses query alias if no alias option is provided. Defaults to `['id', 'createdAt', 'updatedAt', 'deletedAt']`

## Usage

```typescript
query
  .applyOrderFilter(
    {
      orderBy: [
        { field: 'updatedAt', direction: 'desc', nulls: 'last' }
      ],
    },
    { useQuotes: true }
  )
```