import { SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

// strictParams (on in these type tests) can reject null and undefined only with strictNullChecks:
// tsconfig.loose.json leaves this file out

class Event {
  id: string;
  cityId: string | null;
}

declare const qb: SelectQueryBuilder<Event>;
declare const update: UpdateQueryBuilder<Event>;
declare const maybeCity: string | undefined;

// @ts-expect-error = NULL matches no row
qb.whereTyped((q) => q.cityId, '=', { cityId: maybeCity });
// @ts-expect-error = NULL matches no row
qb.whereTyped((q) => q.cityId, '=', null);
// @ts-expect-error NULL never equals
update.whereIsInTyped((q) => q.cityId, [null]);
