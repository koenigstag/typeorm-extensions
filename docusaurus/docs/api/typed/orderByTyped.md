---
sidebar_position: 5
---

# orderByTyped

## Description
`orderByTyped` is a method that applies typesafe order to a query.

## Signature
```typescript
orderByTyped(
  selection: KeyProxyCallback<Entity>,
  order?: 'ASC' | 'DESC',
	nulls?: 'NULLS FIRST' | 'NULLS LAST'
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](../types/KeyProxyCallback): The callback which selects fields of entity.
- order?: 'ASC' | 'DESC': Order direction. Default is 'ASC'.
- nulls?: 'NULLS FIRST' | 'NULLS LAST': NULLS ordering.

## Usage

```typescript
// same as `query.orderBy('user.updatedAt', 'DESC')`
query.orderByTyped(user => user.updatedAt, 'DESC')
```

```typescript
// same as `query.addOrderBy('user.name', 'ASC')`
query.addOrderByTyped(user => user.name, 'ASC')
```
