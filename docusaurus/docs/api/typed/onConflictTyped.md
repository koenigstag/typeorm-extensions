---
sidebar_position: 7.5
---

# onConflictTyped

## Description
`onConflictTyped` adds `ON CONFLICT` to an INSERT with the columns picked by property, on PostgreSQL and SQLite.

- `target` lists the properties of the unique index or constraint the conflict is on; `targetWhere` is the predicate of a partial unique index, over the bare columns.
- `set` returns an object of properties and SQL for `DO UPDATE SET`. It gets `excluded`, the proposed row (`EXCLUDED."column"`), and `current`, the row already in the table. Without `set` the insert does nothing on a conflict.
- `where` limits the update: a conflicting row that fails it is left as it is.
- Properties become their database names (`@Column({ name })`); a relation with one join column gives that column.
- It works on TypeORM 1.x too, which dropped `onConflict()`.
- A property that isn't a column, `set` without `target`, `where` without `set`, an empty `set`, an insert into a table without an entity, or another database throws a `TypeError`.

## Signature
```typescript
onConflictTyped<Type = Entity>(clause: {
  target?: Array<keyof Type>;
  targetWhere?: (columns: ReturningRow<Type>) => string;
  set?: (columns: { current: ReturningRow<Type>; excluded: ReturningRow<Type> }) => { [K in keyof Type]?: string };
  where?: (columns: { current: ReturningRow<Type>; excluded: ReturningRow<Type> }) => string;
}): this
```

## Usage

```typescript
// INSERT INTO "member_mutes" AS "MemberMute" (…) VALUES (…)
// ON CONFLICT ("room_id", "user_id") DO UPDATE SET "muted" = EXCLUDED."muted", "version" = "MemberMute"."version" + 1
// WHERE "MemberMute"."muted" IS DISTINCT FROM EXCLUDED."muted"
await repository
  .createQueryBuilder()
  .insert()
  .values({ roomId, userId, muted })
  .onConflictTyped({
    target: ['roomId', 'userId'],
    set: ({ excluded, current }) => ({ muted: excluded.muted, version: `${current.version} + 1` }),
    where: ({ excluded, current }) => `${current.muted} IS DISTINCT FROM ${excluded.muted}`,
  })
  .execute();

// ON CONFLICT ("user_id") WHERE "community_id" IS NULL DO NOTHING
await repository
  .createQueryBuilder()
  .insert()
  .values({ userId })
  .onConflictTyped({ target: ['userId'], targetWhere: (s) => `${s.communityId} IS NULL` })
  .execute();
```
