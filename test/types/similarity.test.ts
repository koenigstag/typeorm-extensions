import { Brackets, DeleteQueryBuilder, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import 'typeorm-extensions';
import type { Json } from 'typeorm-extensions';

class Article {
  id: number;
  title: string;
  body: string;
  meta: Json<{ author: { name: string } }>;
}

declare const qb: SelectQueryBuilder<Article>;
declare const update: UpdateQueryBuilder<Article>;
declare const remove: DeleteQueryBuilder<Article>;
declare const term: string | null | undefined;

qb.whereSimilarTyped((a) => a.meta.author.name, term);
qb.whereSimilarTyped((a) => a.title, term, { operator: '%>>', minScore: 0.5, unaccent: 'immutable_unaccent', minLength: 3 });
qb.whereSimilarTyped((a) => a.title, term, { operator: false, minScore: 0.1, function: 'word_similarity' });
// @ts-expect-error a distance operator is not a condition
qb.whereSimilarTyped((a) => a.title, term, { operator: '<->' });
// @ts-expect-error operator: false needs a minScore
qb.whereSimilarTyped((a) => a.title, term, { operator: false });
// @ts-expect-error an operator compares its own score
qb.whereSimilarTyped((a) => a.title, term, { operator: '%', function: 'word_similarity' });
// @ts-expect-error the term is text
qb.whereSimilarTyped((a) => a.title, 42);

qb.addSimilarityScoreTyped((a) => [a.title, a.body], term, 's', { combine: 'greatest', nullScore: 0 });
qb.addSimilarityScoreTyped([(a) => a.title, { column: (a) => a.body, weight: 2 }, { sql: 'x' }], term, 's');
// @ts-expect-error not a way to combine
qb.addSimilarityScoreTyped((a) => [a.title, a.body], term, 's', { combine: 'avg' });
// @ts-expect-error a weight is a number
qb.addSimilarityScoreTyped([{ column: (a) => a.body, weight: '2' }], term, 's');

qb.orderBySimilarityTyped((a) => a.title, term, { alias: 'score', direction: 'ASC', nulls: 'first' });
qb.addOrderBySimilarityTyped((a) => a.title, term, { distance: true, function: 'word_similarity' });

qb.whereSearchTyped((a) => [a.title, a.body], term, { similar: { operator: '%>', minScore: 0.5 }, substring: false });
qb.whereSearchTyped((a) => a.title, term, { similar: { operator: false, minScore: 0.2 } });
// @ts-expect-error operator: false needs a minScore
qb.whereSearchTyped((a) => a.title, term, { similar: { operator: false } });

// inside Brackets only the conditions exist: a select or an ORDER BY there would never reach the query
qb.andWhere(
  new Brackets((where) => {
    where.orWhereSimilarTyped<Article>((a) => a.title, term);
    where.orWhereSearchTyped<Article>((a) => a.body, term, { similar: true });
    // @ts-expect-error no ORDER BY inside Brackets
    where.orderBySimilarityTyped<Article>((a) => a.title, term);
    // @ts-expect-error no selection inside Brackets
    where.addSimilarityScoreTyped<Article>((a) => a.title, term, 's');
  }),
);

update.whereSimilarTyped((a) => a.title, term);
remove.andWhereSimilarTyped((a) => a.title, term, { minScore: 0.4 });
// @ts-expect-error no ORDER BY by similarity on an UPDATE
update.orderBySimilarityTyped((a) => a.title, term);

qb.getRawManyWithCursor(null, { orderBy: [{ alias: 'score', direction: 'DESC' }, { selector: '"a"."id"' }] });
// @ts-expect-error a key is a selector or an alias, not both
qb.getRawManyWithCursor(null, { orderBy: [{ alias: 'score', selector: 'x' }] });
