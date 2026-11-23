---
sidebar_position: 6.55
---

# orderBySimilarityTyped

## Description
`orderBySimilarityTyped` / `addOrderBySimilarityTyped` order rows by their trigram similarity to a term (PostgreSQL, [`pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) extension), the most similar first. The score is the one of [addSimilarityScoreTyped](./whereSimilarTyped.md): one column or several, combined, weighted.

```sql
SELECT …, similarity("product"."name", $1) AS "similarity_ab12c"
…
ORDER BY similarity_ab12c DESC NULLS LAST
```

- The score is selected under an alias and the query orders by the alias, as [orderByArrayPositionTyped](./orderByArrayPositionTyped.md) does: TypeORM can't order by a function together with `take` / `skip` and joined collections (`alias was not found`), but it can order by a selection alias. The alias is generated, in lower case, or `options.alias`.
- `NULLS LAST` by default: a row whose columns are NULL has a NULL score, which `DESC` alone would put **first**.
- `orderBySimilarityTyped` replaces the ORDER BY, like `orderBy`; `addOrderBySimilarityTyped` appends to it, like `addOrderBy`, so the score can rank within your own order, or after it.
- A blank term adds neither the selection nor the ORDER BY: a search box left empty keeps the list's own order.
- Ordering by a score never uses an index: every row the WHERE keeps is scored and sorted. Filter first ([whereSimilarTyped](./whereSimilarTyped.md), [whereSearchTyped](./whereSearchTyped.md) with `similar`), or use `distance` with a GiST index and `limit`.

**PostgreSQL only** (and compatible databases such as CockroachDB, where only `similarity` is verified). Another database throws a `TypeError`.

### Distance and a GiST index

With `distance: true` the query orders by the pg_trgm distance operator, `1 - score`, nearest first:

| `function` | selected | order |
|---|---|---|
| `'similarity'` (default) | `col <-> :term` | `ASC NULLS LAST` |
| `'word_similarity'` | `col <->> :term` | `ASC NULLS LAST` |
| `'strict_word_similarity'` | `col <->>> :term` | `ASC NULLS LAST` |

With a GiST index on the column (`USING gist (col gist_trgm_ops)`) and `limit`, PostgreSQL reads the nearest rows from the index (`Index Scan … Order By`) instead of scoring every row. One column, without a weight, `unaccent` or `nullScore`. Use `limit`, not `take`: the query TypeORM wraps around `take` with joins can't use the index for its order.

## Signature
```typescript
orderBySimilarityTyped(selection: SimilaritySelectors<Entity>, term: string | null | undefined, options?: SimilarityOrderOptions): this
addOrderBySimilarityTyped(selection: SimilaritySelectors<Entity>, term: string | null | undefined, options?: SimilarityOrderOptions): this

type SimilarityOrderOptions = {
  function?: 'similarity' | 'word_similarity' | 'strict_word_similarity';
  combine?: 'greatest' | 'sum';
  nullScore?: number;
  unaccent?: boolean | string;
  alias?: string;
  direction?: 'ASC' | 'DESC';
  nulls?: 'first' | 'last';
  distance?: boolean;
};
```

## Arguments
- selection: A [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md) selecting one column or several, or an array of callbacks, raw `{ sql }` expressions and `{ column, weight }`; see [addSimilarityScoreTyped](./whereSimilarTyped.md#arguments).
- term: string | null | undefined: The text to compare with.
- options.function, options.combine, options.nullScore, options.unaccent: As in [addSimilarityScoreTyped](./whereSimilarTyped.md#arguments). Several columns need `combine`.
- options.alias: The alias of the selected score, when the rows should carry it under a known name. A lower-case identifier of at most 63 characters that isn't a reserved word (`score`, `name_score`); anything else throws a `TypeError`, because TypeORM writes the ORDER BY key unquoted.
- options.direction: `'DESC'` by default, `'ASC'` with `distance`.
- options.nulls: `'last'` by default.
- options.distance: Order by the distance operator, see above.

## Usage

```typescript
// ILIKE or trigram-similar on two columns, the best match first, offset pages
// WHERE ("product"."name" ILIKE $1 OR "product"."name" % $2 OR "product"."sku" ILIKE $1 OR "product"."sku" % $2)
// ORDER BY similarity_ab12c DESC NULLS LAST, "product"."id" ASC
const page = await productsRepository
  .createQueryBuilder('product')
  .leftJoinAndSelect('product.images', 'image')
  .andWhereSearchTyped(p => [p.name, p.sku], dto.search, { similar: true })
  .orderBySimilarityTyped(p => [p.name, p.sku], dto.search, { combine: 'greatest' })
  .addOrderByTyped(p => p.id, 'ASC')
  .getManyWithTotals(dto, { useTakeAndSkip: true });
```

```typescript
// your order first, the score within it
query
  .orderBy('product.featured', 'DESC')
  .addOrderBySimilarityTyped(p => p.name, dto.search)
```

```typescript
// the ten nearest names, through a GiST index
// ORDER BY similarity_ab12c ASC NULLS LAST LIMIT 10
query.orderBySimilarityTyped(u => u.lastName, term, { distance: true }).limit(10)
```

- Call `select` / `selectTyped` **before** these methods: a later `select` replaces the selection, and the ORDER BY would point at an alias the query no longer selects.
- Add a unique key after the score (`addOrderByTyped(p => p.id)`) for stable offset pages: rows with equal scores have no order of their own.
- For keyset pages, select the score with `addSimilarityScoreTyped(…, 'score', { nullScore: 0 })` and pass `{ alias: 'score' }` to [getRawManyWithCursor](../pagination/getRawManyWithCursor.md); it replaces the ORDER BY with its keys.
