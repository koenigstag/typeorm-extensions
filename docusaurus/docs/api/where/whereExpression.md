---
sidebar_position: 6.5
---

# whereExpression

## Description

A condition on an SQL expression rather than a column: a function over columns (`coalesce(…)`, `lower(…)`), a date expression (`AT TIME ZONE`, `::date`), arithmetic. The expression is written as is; the comparison is a TypeORM find operator, as [whereTyped](../typed/whereTyped.md#find-operators) takes it, or an SQL condition with its value.

With a find operator the values are bound under unique parameter names (`:op_…`), so two conditions never overwrite each other's values, and `Or(…)` works on every TypeORM version.

Build the expression from quoted columns ([tableHelper](../utils/tableHelper.md), the [SQL helpers](../utils/sql.md)), never from input: it reaches the database verbatim. Parenthesize an expression whose operators bind looser than a comparison (`a OR b`, `a AND b`).

Available on `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` and `SoftDeleteQueryBuilder` (`softDelete()`, `restore()`), and in `Brackets`.

## Signature

```typescript
whereExpression(expression: string, condition: string | FindOperator<unknown>, params?: unknown, options?: WhereExpressionOptions): this
andWhereExpression(expression: string, condition: string | FindOperator<unknown>, params?: unknown, options?: WhereExpressionOptions): this
orWhereExpression(expression: string, condition: string | FindOperator<unknown>, params?: unknown, options?: WhereExpressionOptions): this
```

## Arguments

- expression: string: The SQL expression to compare, written as is.
- condition: string | FindOperator: A TypeORM find operator (`IsNull()`, `MoreThan(date)`, `IsIn([…])`, `Or(…)`), which takes no `params`, or an SQL condition (`'>'`, `'IS NOT NULL'`, `'= :name'`).
- params?: unknown: The value of an SQL condition: the value itself (`'>'`, `since`), appended under a unique placeholder, or an object whose keys the condition names (`'= :name'`, `{ name }`).
- options?: \{ addValue?: boolean \}: Whether the value is appended after the condition. Defaults to `true`, or to `false` when the condition names a key of `params`.

An empty expression, or a condition that is neither a find operator nor SQL, throws a `TypeError`: a condition left out would read more rows than asked for.

## Usage

```typescript
import { IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { IsIn, Or, Sql, tableHelper } from 'typeorm-extensions/helpers';

const sql = Sql.for('postgres');
const orders = tableHelper(OrderEntity, 'order');

query
  // WHERE COALESCE("order"."paidAt", "order"."createdAt") < :op_k2x9q
  .whereExpression(sql.coalesce(orders.paidAt, orders.createdAt), LessThan(since))
  // AND LOWER("order"."note") IN (:op_m4w1z, :op_c8r3t)
  .andWhereExpression(sql.lower(orders.note), IsIn(['gift', 'refund']))
  // AND ("order"."total" - "order"."refunded" IS NULL OR "order"."total" - "order"."refunded" > :op_p5n7h)
  .andWhereExpression(`${orders.total} - ${orders.refunded}`, Or(IsNull(), MoreThan(0)))
  // AND NOT(("order"."paidAt" AT TIME ZONE 'UTC')::date IS NULL)
  .andWhereExpression(`(${orders.paidAt} AT TIME ZONE 'UTC')::date`, Not(IsNull()));
```

```typescript
// an SQL condition, with its value appended or named
query
  .whereExpression(sql.lower(orders.note), '= :note', { note })
  .andWhereExpression(`${orders.total} * 2`, '>', limit); // > :where_xdOnI
```

For a condition on a column, use [whereTyped](../typed/whereTyped.md), which takes the column from an entity property.
