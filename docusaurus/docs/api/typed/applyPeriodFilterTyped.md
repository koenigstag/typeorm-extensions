---
sidebar_position: 5.9
---

# applyPeriodFilterTyped

## Description
`applyPeriodFilterTyped` filters rows by a period of an entity property. It works like [applyPeriodFilter](../where/applyPeriodFilter.md): optional, inclusive ends (`includeFrom` / `includeTo` to exclude them), date-only strings as whole days, conditions added with AND around existing ones.

The property is mapped to its database column (`@Column({ name })`), and on `UpdateQueryBuilder` / `DeleteQueryBuilder` the column is not prefixed with an alias.

## Signature
```typescript
applyPeriodFilterTyped(
  selection: KeyProxyCallback<Entity>,
  periodFilter: PeriodFilter | null | undefined,
  options?: { includeFrom?: boolean; includeTo?: boolean }
): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** date / time property. Selecting several throws a `TypeError`.
- periodFilter: `{ periodFrom?: Date | string; periodTo?: Date | string }`: The period, see [applyPeriodFilter](../where/applyPeriodFilter.md).
- options: Which ends are included, both by default.

## Usage

```typescript
// WHERE "order"."created_at" >= $1 AND "order"."created_at" < $2, $1 = '2024-01-01', $2 = '2024-02-01'
query.applyPeriodFilterTyped(order => order.createdAt, { periodFrom: '2024-01-01', periodTo: '2024-01-31' })
```

```typescript
// delete rows older than a year
repository
  .createQueryBuilder()
  .delete()
  .applyPeriodFilterTyped(log => log.createdAt, { periodTo: yearAgo }, { includeTo: false })
  .execute()
```
