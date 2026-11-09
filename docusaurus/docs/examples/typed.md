---
sidebar_position: 4
---

# Typed queries

This category provides examples for typed methods and `tableHelper`.

## Typed query

[API reference](/docs/api/typed/)

```typescript
import 'typeorm-extensions';

const users = await usersRepository
  .createQueryBuilder('user')
  // join relation defined in entity model, alias = relation name
  .leftJoinTyped(user => user.images, 'images')
  // select own and relation columns
  .selectTyped(user => [user.id, user.name, user.images.url])
  // conditions
  .whereTyped(user => user.name, 'ILIKE', '%john%')
  .andWhereIsInTyped(user => user.id, ids)
  .andWhereTyped(user => user.images.url, 'IS NOT NULL')
  // order by own and relation columns
  .orderByTyped(user => user.images.url, 'ASC', 'NULLS LAST')
  .addOrderByTyped(user => user.createdAt, 'DESC')
  .getMany();
```

## Conditions with placeholders

[API reference](/docs/api/typed/whereTyped)

```typescript
query
  // value is appended with a unique placeholder: "user"."id" > :where_xxxxx
  .whereTyped(user => user.id, '>', 100)
  // `:from` and `:to` are keys of params, so nothing is appended
  .andWhereTyped(user => user.createdAt, 'BETWEEN :from AND :to', { from, to })
```

## JSON columns

[API reference](/docs/api/typed/whereTyped#paths-into-json-columns)

```typescript
import { Json } from 'typeorm-extensions';

@Entity()
class UserEntity {
  // Json<T> lets typed callbacks go deeper than `metadata.role`
  @Column({ type: 'jsonb' })
  metadata: Json<{ role: string; loginCount: number; settings: { theme: string } }>;
}

query
  // "user"."metadata" ->> 'role' = :param
  .whereTyped(user => user.metadata.role, '=', 'admin')
  // "user"."metadata" -> 'settings' ->> 'theme' = :param
  .andWhereTyped(user => user.metadata.settings.theme, '=', 'dark')
  // CAST("user"."metadata" ->> 'loginCount' AS numeric) >= :param, compared as a number
  .andWhereTyped(user => user.metadata.loginCount, '>=', 10)
```

Select, order and distinct take columns: for a JSON value there, use [tableHelper](/docs/api/utils/tableHelper#jsonb).

```typescript
import { tableHelper } from 'typeorm-extensions';

const t = tableHelper<UserEntity>('user');

// SELECT "user"."metadata" ->> 'role' AS "role" …
query.addSelect(t.jsonColumn('metadata', '->>', 'role'), 'role')
```

## Join condition with tableHelper

[API reference](/docs/api/utils/tableHelper#composing-helpers)

```typescript
import { tableHelper } from 'typeorm-extensions';

const user = tableHelper<UserEntity>('user');
const image = tableHelper<ImageEntity>('images');

query
  // ON "user"."id" = "images"."userId": both sides quoted, so camelCase columns keep their case
  .leftJoin(ImageEntity, 'images', user.joinOn('id', `= ${image.column('userId')}`))
  .andWhere(image.isNotNull('url'))
```

## Page with totals

[API reference](/docs/api/pagination/getManyWithTotals)

```typescript
const { list, total } = await usersRepository
  .createQueryBuilder('user')
  .whereTyped(user => user.name, 'ILIKE', '%john%')
  .orderByTyped(user => user.createdAt, 'DESC')
  .getManyWithTotals({ page: 1, pageSize: 20 });
```
