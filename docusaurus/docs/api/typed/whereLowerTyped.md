---
sidebar_position: 5.87
---

# whereLowerEqualsTyped / whereIsInLowerTyped

## Description
Typesafe case-insensitive equality: both the column and the value are wrapped with `LOWER(…)`.

```sql
LOWER("user"."email") = LOWER(:p)
LOWER("user"."email") IN (LOWER(:p_0), LOWER(:p_1))
```

`normalize` changes the wrapping of both sides. Write it the same way as the expression index the query should use, e.g. `LOWER(TRIM("email"))`. The value is normalized by the database rather than in JavaScript, so it gets the same rules as the column.

- `null` / `undefined` for `whereLowerEqualsTyped`, or an empty / missing list for `whereIsInLowerTyped`, matches nothing (`FALSE`), like `whereIsIn`.
- `whereIsInLowerTyped` binds one parameter per value, since each one is wrapped separately.
- Works on any database. On `UpdateQueryBuilder` / `DeleteQueryBuilder` the column is not prefixed with an alias.

## Signature
```typescript
whereLowerEqualsTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedLowerOptions): this
andWhereLowerEqualsTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedLowerOptions): this
orWhereLowerEqualsTyped(selection: KeyProxyCallback<Entity>, value: string | null | undefined, options?: TypedLowerOptions): this

whereIsInLowerTyped(selection: KeyProxyCallback<Entity>, values: readonly string[] | null | undefined, options?: TypedLowerOptions): this
andWhereIsInLowerTyped(selection: KeyProxyCallback<Entity>, values: readonly string[] | null | undefined, options?: TypedLowerOptions): this
orWhereIsInLowerTyped(selection: KeyProxyCallback<Entity>, values: readonly string[] | null | undefined, options?: TypedLowerOptions): this
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity.
- value / values: The value, or the list of values, to compare with.
- options?: TypedLowerOptions:
  - normalize?: `(sql: string) => string`: Wraps the column and each parameter. Defaults to ``sql => `LOWER(${sql})` ``. The result must contain its argument, otherwise a `TypeError` is thrown.

## Usage

```typescript
// WHERE LOWER("user"."email") = LOWER($1)
query.whereLowerEqualsTyped(user => user.email, dto.email)
```

```typescript
// CREATE INDEX invitations_email_idx ON invitations (LOWER(TRIM("recipientEmail")));
const lowerTrim = (sql: string) => `LOWER(TRIM(${sql}))`;

// AND LOWER(TRIM("invitation"."recipientEmail")) IN (LOWER(TRIM($1)), LOWER(TRIM($2)))
query.andWhereIsInLowerTyped(invitation => invitation.recipientEmail, emails, { normalize: lowerTrim })
```
