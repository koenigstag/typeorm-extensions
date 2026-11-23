---
sidebar_position: 5.88
---

# whereSimilarTyped / addSimilarityScoreTyped

## Description
Typesafe trigram similarity (PostgreSQL, [`pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) extension) for fuzzy search with typos. [Fuzzy search with pg_trgm](/docs/examples/fuzzy-search) puts the filter, the score and the order together, with the indexes they need.

`whereSimilarTyped` always puts the column on the left of the operator. That is the form a `gin_trgm_ops` / `gist_trgm_ops` index on the column can be used for:

| `operator` | SQL | Meaning | Index |
|---|---|---|---|
| `'%'` (default) | `col % :term` | `similarity(col, term)` ≥ `pg_trgm.similarity_threshold` (0.3) | yes |
| `'%>'` | `col %> :term` | the term is similar to a word of the column: `word_similarity(term, col)` ≥ `pg_trgm.word_similarity_threshold` (0.6) | yes |
| `'<%'` | `col <% :term` | the column is similar to a word of the term | no |
| `'%>>'` | `col %>> :term` | the term is similar to whole words of the column: `strict_word_similarity(term, col)` ≥ `pg_trgm.strict_word_similarity_threshold` (0.5) | yes |
| `'<<%'` | `col <<% :term` | the column is similar to whole words of the term | no |
| `false` | `similarity(col, :term) >= :min` | the score alone, with `minScore` | no |

`:term <% col` written by hand is the same condition as `col %> :term`: use `operator: '%>'` for it, and `'%>>'` for `:term <<% col`.

The term is trimmed. `null`, `undefined`, a blank term or one shorter than `minLength` adds no condition.

A path into a JSON column is put in parentheses: `%` binds tighter than `->>` and `||`, so `"a"."meta" ->> 'name' % :t` would read as `"a"."meta" ->> ('name' % :t)` and fail.

**PostgreSQL only.** On another database `%` is the modulo operator: `col % 'jon'` runs and matches no row. These methods throw a `TypeError` there instead. A query builder without a connection is taken for PostgreSQL. CockroachDB passes the check; its support for the word operators and their scores is unverified.

### A score cutoff

`minScore` also requires the operator's own score to reach a value, in parentheses so it reads the same in an OR chain:

| `operator` | with `minScore: 0.7` |
|---|---|
| `'%'` | `(col % :t AND similarity(col, :t) >= :min)` |
| `'%>'` | `(col %> :t AND word_similarity(:t, col) >= :min)` |
| `'<%'` | `(col <% :t AND word_similarity(col, :t) >= :min)` |
| `'%>>'` | `(col %>> :t AND strict_word_similarity(:t, col) >= :min)` |
| `'<<%'` | `(col <<% :t AND strict_word_similarity(col, :t) >= :min)` |

The operator still filters at its session threshold first, through the index, so a cutoff can only be stricter than that threshold. For a lower one, use `operator: false` (no index: every row is scored) or [raise the threshold for one transaction](/docs/examples/fuzzy-search#a-lower-threshold-for-one-query).

`addSimilarityScoreTyped` selects a score under an alias. To order by it, [orderBySimilarityTyped](./orderBySimilarityTyped.md) selects and orders in one call.

## Signature
```typescript
whereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: TypedSimilarOptions): this
andWhereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: TypedSimilarOptions): this
orWhereSimilarTyped(selection: KeyProxyCallback<Entity>, term: string | null | undefined, options?: TypedSimilarOptions): this

type TypedSimilarOptions = {
  unaccent?: boolean | string;
  minLength?: number;
} & (
  | { operator?: '%' | '%>' | '<%' | '%>>' | '<<%'; minScore?: number }
  | { operator: false; minScore: number; function?: 'similarity' | 'word_similarity' | 'strict_word_similarity' }
);

addSimilarityScoreTyped(
  selection: KeyProxyCallback<Entity> | Array<KeyProxyCallback<Entity> | { sql: string } | { column: …; weight: number }>,
  term: string | null | undefined,
  alias: string,
  options?: SimilarityScoreOptions
): SelectQueryBuilder<Entity>

type SimilarityScoreOptions = {
  function?: 'similarity' | 'word_similarity' | 'strict_word_similarity';
  combine?: 'greatest' | 'sum';
  nullScore?: number;
  unaccent?: boolean | string;
};
```

## Arguments
- selection: [KeyProxyCallback&lt;Entity&gt;](./types/KeyProxyCallback.md): The callback which selects **one** field of entity for the where methods. `addSimilarityScoreTyped` also takes several columns, raw `{ sql }` expressions (in parentheses, never from user input) and `{ column, weight }`.
- term: string | null | undefined: The text to compare with.
- options.operator: See the table above. Defaults to `'%'`.
- options.minScore: A score from 0 to 1 the operator's score must reach; required with `operator: false`. Anything else throws a `TypeError`. It is bound as a parameter.
- options.function: With `operator: false` only, the score to compare: `similarity(col, :t)` (default), `word_similarity(:t, col)` or `strict_word_similarity(:t, col)`.
- options.unaccent: Compare without accents (`unaccent` extension): `unaccent(col) % unaccent(:t)`. A string names the function, e.g. an IMMUTABLE wrapper an expression index is built on.
- options.minLength: The shortest term that adds a condition. Defaults to `1`.
- alias: string: The alias of the score. Ordering by it yourself, use a lower-case one: PostgreSQL folds an unquoted alias in `ORDER BY`.
- options.function (score): `'similarity'` (default) gives `similarity(col, :term)` and pairs with `%`. `'word_similarity'` and `'strict_word_similarity'` give `word_similarity(:term, col)` and pair with `%>` / `%>>`.
- options.combine: Required for more than one column. `'greatest'` gives `GREATEST(s1, s2)`, which skips NULL scores; `'sum'` gives `COALESCE(s1, 0) + COALESCE(s2, 0)`.
- options.nullScore: The score of a row whose columns are all NULL: `COALESCE(score, n)`. Every pg_trgm function returns NULL for a NULL column.
- `{ column, weight }`: multiplies the score of the column: `similarity(col, :t) * 2`. A weight must be a finite number.

A blank term still selects the score, with `''` bound: every row scores 0, and an `ORDER BY` of the alias stays valid.

## Usage

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_name_trgm ON products USING GIN (name gin_trgm_ops);
```

```typescript
// WHERE "product"."name" %> $1 ORDER BY score DESC NULLS LAST
query
  .whereSimilarTyped(product => product.name, dto.search, { operator: '%>' })
  .addSimilarityScoreTyped(product => product.name, dto.search, 'score', { function: 'word_similarity' })
  .orderBy('score', 'DESC', 'NULLS LAST')
```

```typescript
// a long text: a short term never reaches the threshold of `%` against a whole paragraph
// AND ("article"."title" % $1 OR ("article"."body" %> $2 AND word_similarity($2, "article"."body") >= $3))
query.andWhere(new Brackets(where => where
  .whereSimilarTyped(a => a.title, term)
  .orWhereSimilarTyped(a => a.body, term, { operator: '%>', minScore: 0.7 })))
```

```typescript
// a path into a JSON column, without accents
// WHERE immutable_unaccent("article"."meta" -> 'author' ->> 'name') % immutable_unaccent($1)
query
  .whereSimilarTyped(a => a.meta.author.name, term, { unaccent: 'immutable_unaccent' })
  .addSimilarityScoreTyped(a => a.meta.author.name, term, 'author_score', { unaccent: 'immutable_unaccent', nullScore: 0 })
```

```typescript
// the best of two columns, the name counting double
query.addSimilarityScoreTyped(
  [{ column: p => p.name, weight: 2 }, p => p.sku],
  term,
  'score',
  { combine: 'greatest' },
)
```
