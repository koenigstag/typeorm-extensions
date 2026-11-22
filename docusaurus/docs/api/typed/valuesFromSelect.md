---
sidebar_position: 7.6
---

# valuesFromSelect

## Description
`valuesFromSelect` makes an INSERT take its rows from a select query: `INSERT INTO … (columns) SELECT …`, in place of `values()`.

- `columns` maps each property to the SQL its rows get, over the aliases of the select. Properties become their database names (`@Column({ name })`).
- TypeORM still writes the statement: the table, the column list, `orIgnore`, `onConflictTyped` and `returning`. Only `VALUES (…)` is replaced by the select.
- The select's own selections are replaced by `columns`, in the order TypeORM lists the columns, so the SQL lines up with its column whatever order the object has. Its parameters are renamed unique, so they can't collide with the insert's or another subquery's.
- The subquery is a query builder, or a factory that builds it on the insert's connection and transaction.
- There is no entity: listeners and subscribers don't run, and nothing is updated from the returned rows. `returning` still gives the rows in `execute()`'s `raw`.
- Works on PostgreSQL, MySQL and SQLite; the conflict clause is PostgreSQL and SQLite only, as `onConflictTyped` is.
- A property that isn't an inserted column, an empty `columns`, `values()` next to it, or an insert into a table without an entity throws a `TypeError`.

## Signature
```typescript
valuesFromSelect<Type = Entity>(
  subQuery: SelectQueryBuilder<ObjectLiteral> | ((subQuery: SelectQueryBuilder<ObjectLiteral>) => SelectQueryBuilder<ObjectLiteral>),
  columns: { [K in keyof Type]?: string }
): this
```

## Usage

```typescript
const user = tableHelper<User>('u');

// INSERT INTO "tickets" AS "Ticket"("status", "owner_id") SELECT ('new'), ("u"."id") FROM "users" "u" WHERE "u"."active" = $1
// ON CONFLICT ("owner_id") DO NOTHING
await ticketRepository
  .createQueryBuilder()
  .insert()
  .valuesFromSelect((sub) => sub.from(User, 'u').where(`${user.active} = :active`, { active: true }), {
    ownerId: user.id,
    status: "'new'",
  })
  .onConflictTyped({ target: ['ownerId'] })
  .execute();

// rows zipped from arrays (PostgreSQL)
await linkRepository
  .createQueryBuilder()
  .insert()
  .valuesFromSelect(
    (sub) =>
      sub
        .from(`(${unnestRows(tableHelper<{ tagId: string; postId: string }>('t'), { tagId: ':tagIds::uuid[]', postId: ':postIds::uuid[]' })})`, 'src')
        .setParameters({ tagIds, postIds }),
    { tagId: '"src"."tagId"', postId: '"src"."postId"' }
  )
  .orIgnore()
  .execute();
```
