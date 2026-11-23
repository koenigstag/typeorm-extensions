---
sidebar_position: 5
---

# Fuzzy search with pg_trgm

Search that forgives typos, on PostgreSQL with the [`pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) extension. Three independent pieces, each usable alone:

| Piece | Methods | Where it works |
|---|---|---|
| **filter** | [whereSimilarTyped](/docs/api/typed/whereSimilarTyped), [whereSearchTyped](/docs/api/typed/whereSearchTyped) with `similar` | every WHERE builder, inside `Brackets` and EXISTS subqueries too |
| **score** | [addSimilarityScoreTyped](/docs/api/typed/whereSimilarTyped) | `SelectQueryBuilder` |
| **order** | [orderBySimilarityTyped / addOrderBySimilarityTyped](/docs/api/typed/orderBySimilarityTyped) | `SelectQueryBuilder` |

None of them touches the others: the filter adds no selection, the order never changes the WHERE, and `addOrderBySimilarityTyped` appends to your ORDER BY instead of replacing it. The library chooses no numbers for you: no cutoff, no priorities. The defaults are PostgreSQL's own: `%`, `similarity()` and the session threshold.

## Setup

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trusted since PostgreSQL 13: a database owner can install it
CREATE INDEX products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX products_sku_trgm ON products USING GIN (sku gin_trgm_ops);
```

## Filter, score and order

```typescript
const term = dto.search?.trim() ?? '';

const page = await productsRepository
  .createQueryBuilder('product')
  .andWhereSearchTyped(p => [p.name, p.sku], term, { similar: term.length >= 3 })
  .orderBySimilarityTyped(p => [p.name, p.sku], term, { combine: 'greatest' })
  .addOrderByTyped(p => p.id, 'ASC')
  .getManyWithTotals(dto);
```
```sql
SELECT …, GREATEST(similarity("product"."name", $3), similarity("product"."sku", $3)) AS "similarity_ab12c"
FROM "products" "product"
WHERE ("product"."name" ILIKE $1 OR "product"."name" % $2 OR "product"."sku" ILIKE $1 OR "product"."sku" % $2)
ORDER BY similarity_ab12c DESC NULLS LAST, "product"."id" ASC
LIMIT 10
```

- The id after the score keeps offset pages stable: rows with equal scores have no order of their own.
- `getManyWithTotals` counts on a copy of the query without its selection and order, so the score costs nothing there. With joined collections pass `useTakeAndSkip: true`: the order is by a selection alias, which TypeORM's take / skip query supports.
- Call `select` / `selectTyped` before the order methods. A later `select` replaces the selection, and the ORDER BY would point at an alias the query no longer has.
- An empty search box adds no condition and no order: the list keeps its own.

## Ranking bands

An exact match first, then a substring, then the rest by similarity: that ranking is a policy of your application, built from [`Sql`](/docs/api/utils/sql) and the order methods:

```typescript
const u = tableHelper(User, 'user');
const exactName = `${Sql.lower(u.name)} = LOWER(:q)`;
const nameContains = `${u.name} ILIKE :qPattern`;
const matchRank = Sql.case([{ when: exactName, then: 2 }, { when: nameContains, then: 1 }], { else: 0 });

query
  .andWhereSearchTyped(x => x.name, q, { similar: true })
  .addSelect(matchRank, 'match_rank')
  .setParameters({ q, qPattern: `%${escapeLikePattern(q)}%` })
  .orderBy('match_rank', 'DESC')
  .addOrderBySimilarityTyped(x => x.name, q)
  .addOrderByTyped(x => x.id, 'ASC');
```

`escapeLikePattern` comes from `typeorm-extensions/helpers`. Weights per column go into the score: `[{ column: x => x.name, weight: 2 }, x => x.bio]` with `combine: 'sum'`.

## Indexes

- **GIN** (`USING gin (col gin_trgm_ops)`) serves `%`, `%>` and `%>>` with the column on the left (the form these methods write), `LIKE` / `ILIKE`, regular expressions, and `=` since PostgreSQL 14. It is the usual index for filtering. Several columns joined with OR become a `BitmapOr` over one index per column.
- **GiST** (`USING gist (col gist_trgm_ops(siglen = 64))`, `siglen` since PostgreSQL 13) serves the same filters, usually slower than GIN, and also the nearest rows first: `orderBySimilarityTyped(…, { distance: true })` with `limit`.
- **An operator uses the index, a function doesn't.** `col % :t` is an index scan; `similarity(col, :t) >= 0.5` scores every row. `minScore` pairs them, `(col % :t AND similarity(col, :t) >= :min)`: the index finds the rows at the session threshold, and the stricter cutoff is checked on those only.
- **Ordering by a score never uses an index**: it sorts every row the WHERE keeps. Filter first, or use the distance with a GiST index and `limit`.
- **An expression needs an expression index** of the same SQL:
  - a path into a JSON column: `USING gin ((meta -> 'author' ->> 'name') gin_trgm_ops)`;
  - a concatenation: `USING gin ((coalesce(first_name, '') || ' ' || coalesce(last_name, '')) gin_trgm_ops)`; `concat_ws` isn't IMMUTABLE, so it can't be indexed;
  - `unaccent()` is STABLE: index an IMMUTABLE wrapper and pass its name, `unaccent: 'immutable_unaccent'`.
- **Long text**: a short term against a whole paragraph has a tiny `similarity()`, so `%` rarely matches, and still pays for the index recheck. Use `operator: '%>'`, the term against the words of the column, or ILIKE.
- **Identifiers** such as emails, codes and SKUs: their shared part (a mail domain) dominates the trigrams. Use ILIKE or a prefix match.
- **Short terms**: a pattern under 3 characters gives a trigram index nothing to look up, so it reads the whole index. Use `minLength`, or turn `similar` on from 3 characters as above.
- pg_trgm ignores case itself: `LOWER()` around a trigram operand changes nothing but keeps a plain-column index from matching.

## A lower threshold for one query

`pg_trgm.similarity_threshold` (0.3), `word_similarity_threshold` (0.6) and `strict_word_similarity_threshold` (0.5) are settings of the session. `minScore` can only raise the bar above them. To lower it and keep the index, set the threshold for one transaction: `set_config(…, true)` is `SET LOCAL`, gone when the transaction ends. A plain `SET` on a pooled connection would stay for every later query on it.

```typescript
const products = await dataSource.transaction(async (manager) => {
  await manager.query(`SELECT set_config('pg_trgm.similarity_threshold', '0.2', true)`);

  return manager
    .getRepository(Product)
    .createQueryBuilder('product')
    .whereSimilarTyped(p => p.name, term)
    .getMany();
});
```

Without a transaction, `{ operator: false, minScore: 0.2 }` compares the score alone, which scores every row.

## Keyset pages by score

[getRawManyWithCursor](/docs/api/pagination/getRawManyWithCursor) orders by its own keys. Select the score and name it by its alias:

```typescript
const page = await productsRepository
  .createQueryBuilder('product')
  .select('product.id', 'id')
  .addSelect('product.name', 'name')
  .andWhereSimilarTyped(p => p.name, term, { operator: '%>' })
  .addSimilarityScoreTyped(p => p.name, term, 'score', { function: 'word_similarity', nullScore: 0 })
  .getRawManyWithCursor(dto, { orderBy: [{ alias: 'score', direction: 'DESC' }] });
```
```sql
-- page 2
WHERE "product"."name" %> $1
  AND (COALESCE(word_similarity($2, "product"."name"), 0), "product"."id") < ($3, $4)
ORDER BY COALESCE(word_similarity($2, "product"."name"), 0) DESC, "product"."id" DESC
LIMIT 21
```

- `nullScore: 0`: a cursor key must not be NULL, and a NULL column scores NULL.
- Each request builds the query again, with new parameter names: the cursor names its keys by their SQL with the parameter names left out, so a cursor from one request fits the next.
- The term is not part of the cursor. A cursor sent with another term reads as a position in the new results: start from the first page when the term changes.
- A score is `real`, or `double precision` once weighted. node-postgres reads both as JS numbers, and PostgreSQL 12+ writes them in their shortest exact form, so the cursor compares the exact value.

## Pitfalls

- **Other databases**: on MySQL and SQLite `%` is the modulo operator and the query would run and match nothing. These methods throw a `TypeError` there. CockroachDB passes the check; its support for the word operators, their scores and the distance operators is unverified.
- **NULLs**: every pg_trgm function returns NULL for a NULL column, and `DESC` sorts NULL first. The order methods write `NULLS LAST`, `combine: 'sum'` adds `COALESCE(…, 0)` around each column, and `nullScore` gives the whole score a value.
- **Raw expressions**: `{ sql }` selectors are written into the query as they are. They are for SQL you write, never for user input. The term itself is always a bound parameter.
