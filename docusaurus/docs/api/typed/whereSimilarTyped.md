---
sidebar_position: 5.88
---

# whereSimilarTyped / addSimilarityScoreTyped

## Description
Typesafe trigram similarity (PostgreSQL, [`pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) extension) for fuzzy search with typos.

`whereSimilarTyped` always puts the column on the left of the operator. That is the form a `gin_trgm_ops` / `gist_trgm_ops` index on the column can be used for:

| `operator` | SQL | Meaning | Index |
|---|---|---|---|
| `'%'` (default) | `col % :term` | `similarity(col, term)` > `pg_trgm.similarity_threshold` (0.3) | yes |
| `'%>'` | `col %> :term` | the term is similar to a word of the column: `word_similarity(term, col)` > `pg_trgm.word_similarity_threshold` (0.6) | yes |
| `'<%'` | `col <% :term` | the column is similar to a word of the term | no |

`:term <% col` written by hand is the same condition as `col %> :term`: use `operator: '%>'` for it.

The term is trimmed. `null`, `undefined` or a blank term adds no condition.

`addSimilarityScoreTyped` selects a score under an alias, to order by.

## Signature
```typescript
whereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: { operator?: '%' | '%>' | '<%' }): this
andWhereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: { operator?: '%' | '%>' | '<%' }): this
orWhereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: { operator?: '%' | '%>' | '<%' }): this

addSimilarityScoreTyped(
  selection: KeyProxyCallback<Entity>,
  term: string | null | undefined,
  alias: string,
  options?: { function?: 'similarity' | 'word_similarity' | 'strict_word_similarity' }
): SelectQueryBuilder<Entity>
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity.
- term: string | null | undefined: The text to compare with.
- alias: string: The alias of the score. Use a lower-case one: PostgreSQL folds an unquoted alias in `ORDER BY`.
- options.function: `'similarity'` (default) gives `similarity(col, :term)` and pairs with `%`. `'word_similarity'` and `'strict_word_similarity'` give `word_similarity(:term, col)` and pair with `%>`.

## Usage

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX clubs_name_trgm ON clubs USING GIN (name gin_trgm_ops);
```

```typescript
// WHERE "club"."name" %> $1 ORDER BY score DESC
query
  .whereSimilarTyped(club => club.name, dto.search, { operator: '%>' })
  .addSimilarityScoreTyped(club => club.name, dto.search, 'score', { function: 'word_similarity' })
  .orderBy('score', 'DESC')
```
