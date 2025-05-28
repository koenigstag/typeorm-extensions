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

- `orderFilter: OrderFilter<Entity>`: The order options to apply to the query.
  - `orderBy: Array<OrderParam>`: Order configurations.
- `orderOptions?: ApplyOrderOptions`: Additional options to apply to the order filter.
  - `useDoubleQuotes?: boolean`: Whether to wrap the order field with double qoutes (defaults to true).
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
    { useDoubleQuotes: true }
  )
```