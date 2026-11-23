import { Brackets, DeleteQueryBuilder, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

declare module 'typeorm-extensions' {
  interface TypeormExtensionsConfig {
    strictParams: true;
  }
}

enum Status {
  Active = 'active',
  Draft = 'draft',
}

interface Settings {
  theme: string;
}

class Community {
  id: string;
  name: string;
  createdAt: Date;
}

class Event {
  id: string;
  price: number;
  startsAt: Date;
  endsAt: Date | null;
  cityId: string | null;
  status: Status;
  isPublic: boolean;
  settings: Settings;
  tags: string[];
  community: Community;
}

type Joins = { e: Event; c: Community };

declare const qb: SelectQueryBuilder<Event>;
declare const update: UpdateQueryBuilder<Event>;
declare const remove: DeleteQueryBuilder<Event>;
declare const maybeCity: string | undefined;
declare const operator: string;

// comparisons: the value, or a { name: value } params object, of the column's type
qb.whereTyped((q) => q.id, '=', 'a');
qb.whereTyped((q) => q.id, '=', { id: 'a' });
qb.andWhereTyped((q) => q.price, '>=', { minPrice: 10 });
qb.orWhereTyped((q) => q.status, '=', Status.Active);
qb.whereTyped((q) => q.isPublic, '<>', false);
qb.whereTyped((q) => q.community.name, '=', { name: 'a' });
// @ts-expect-error a number for a string column
qb.whereTyped((q) => q.id, '=', { id: 5 });
// @ts-expect-error a string for a number column
qb.whereTyped((q) => q.price, '>', '10');
// @ts-expect-error not a Status
qb.whereTyped((q) => q.status, '=', 'deleted');
// @ts-expect-error a relation column is checked too
qb.whereTyped((q) => q.community.name, '=', 5);
// null and undefined values: strict-null-checks.test.ts
// @ts-expect-error the value is required
qb.whereTyped((q) => q.id, '=');

// dates: a Date or a string, on the first level and through a relation
qb.whereTyped((q) => q.startsAt, '<', new Date());
qb.whereTyped((q) => q.endsAt, '>=', { from: '2026-01-01' });
qb.whereTyped((q) => q.community.createdAt, '<', new Date());
// @ts-expect-error a number for a date column
qb.whereTyped((q) => q.startsAt, '<', 0);

// operators are matched case-insensitively, without surrounding spaces
qb.whereTyped((q) => q.price, ' >= ', 1);
qb.whereTyped((q) => q.cityId, 'is null');
// @ts-expect-error a string for a number column
qb.whereTyped((q) => q.price, 'in', ['1']);

// no value
qb.whereTyped((q) => q.cityId, 'IS NULL');
qb.whereTyped((q) => q.isPublic, 'IS NOT TRUE');
// @ts-expect-error IS NULL takes no value
qb.whereTyped((q) => q.cityId, 'IS NULL', { cityId: 'a' });
qb.whereTyped((q) => q.cityId, 'IS', null);
// @ts-expect-error IS takes only NULL
qb.whereTyped((q) => q.cityId, 'IS', 'a');

// IS [NOT] DISTINCT FROM: NULL is a value there
qb.whereTyped((q) => q.cityId, 'IS DISTINCT FROM', null);
qb.whereTyped((q) => q.cityId, 'IS NOT DISTINCT FROM', { cityId: 'a' });
// @ts-expect-error a number for a string column
qb.whereTyped((q) => q.cityId, 'IS DISTINCT FROM', 1);

// lists
qb.whereTyped((q) => q.id, 'IN', ['a', 'b']);
qb.whereTyped((q) => q.status, 'NOT IN', { statuses: [Status.Draft] as const });
// @ts-expect-error IN takes an array
qb.whereTyped((q) => q.id, 'IN', 'a');
// @ts-expect-error not a Status
qb.whereTyped((q) => q.status, 'IN', ['deleted']);

// patterns take a string whatever the column
qb.whereTyped((q) => q.community.name, 'ILIKE', '%a%');
// @ts-expect-error a pattern is a string
qb.whereTyped((q) => q.price, 'LIKE', 1);

// a plain object value (a JSON column) only in a params object: a plain object always is one at runtime
qb.whereTyped((q) => q.settings, '=', { settings: { theme: 'dark' } });
// @ts-expect-error read as { theme: 'dark' } params, i.e. `settings = 'dark'`
qb.whereTyped((q) => q.settings, '=', { theme: 'dark' });
// an array value is a value
qb.whereTyped((q) => q.tags, '=', ['a']);

// conditions written as SQL are not checked
qb.whereTyped((q) => q.startsAt, 'BETWEEN :from AND :to', { from: 1, to: 2 });
qb.whereTyped((q) => q.isPublic, '= true');
qb.whereTyped((q) => q.price, operator, 'anything');

// an explicit type argument keeps unchecked parameters
qb.whereTyped<Joins>((q) => q.e.price, '=', { price: 'oops' });
qb.andWhereTyped<Joins>((q) => q.c.name, 'IS NOT NULL');
qb.whereTyped<any>((q) => q.anything.at.all, '=', { any: 'thing' });
// @ts-expect-error but the proxy is still typed
qb.whereTyped<Joins>((q) => q.e.missing, '=', 1);

// UPDATE / DELETE builders
update.whereTyped((q) => q.id, '=', { id: 'a' });
remove.whereTyped((q) => q.price, '<', 0);
// @ts-expect-error a string for a number column
update.whereTyped((q) => q.price, '=', '1');
// @ts-expect-error a number for a string column
remove.andWhereTyped((q) => q.id, '=', 1);

// a Brackets callback gets an untyped WhereExpressionBuilder: unchecked
qb.andWhere(new Brackets((where) => where.whereTyped((q) => q.anything, '=', 1)));

// whereIsIn / whereIsAny take an array of the column's type
qb.whereIsInTyped((q) => q.id, ['a']);
qb.andWhereIsNotInTyped((q) => q.status, [Status.Active] as const);
qb.whereIsAnyTyped((q) => q.id, ['a'], 'uuid[]');
qb.orWhereIsNotAnyTyped((q) => q.startsAt, [new Date(), '2026-01-01']);
qb.whereIsInTyped<Joins>((q) => q.e.price, ['unchecked']);
// @ts-expect-error a number for a string column
qb.whereIsInTyped((q) => q.id, [1]);
// @ts-expect-error not a Status
qb.whereIsAnyTyped((q) => q.status, ['deleted']);
