import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

class Event {
  id: string;
  eventType: string;
}

class CheckIn {
  id: string;
  customerId: string;
  event: Event;
}

type Joins = { checkin: CheckIn; event: Event };

declare const checkIns: SelectQueryBuilder<CheckIn>;

const typed = checkIns.typed<Joins>();

typed.whereTyped((q) => q.event.eventType, '=', 'class');
typed.whereIsInTyped((q) => q.event.id, ['a']);
typed.selectTyped((q) => q.checkin.customerId, 'customerId');
// TypeORM's own methods keep the root for the calls after them
typed.andWhere('TRUE').orderByTyped((q) => q.checkin.customerId);
typed.leftJoin('checkin.event', 'e').andWhereTyped((q) => q.checkin.id, '=', 'c');

// the entities stay the builder's
const loaded: Promise<CheckIn[]> = typed.getMany();
void loaded;

// a spread copy carries no symbol key, which declaration files can't name (TS4053 / TS4058)
async function spreadCopy() {
  const copy = { ...(await typed.getOneOrFail()) };
  const noSymbolKey: [Extract<keyof typeof copy, symbol>] extends [never] ? true : false = true;
  void noSymbolKey;
}
void spreadCopy;

// without typed() the entity is the root, and an explicit root still wins
checkIns.whereTyped((q) => q.customerId, '=', 'c');
checkIns.whereTyped<Joins>((q) => q.event.eventType, '=', 'class');

// an explicit root on the untyped builder of a Brackets callback, with a type parameter for it
function byEventType<T extends Event | (Event & { capacity: number })>(query: SelectQueryBuilder<T>) {
  query.andWhere(
    new Brackets((where) => {
      where.whereTyped<T>((q) => q.eventType, '=', { eventType: 'class' });
      where.orWhereIsInTyped<T>((q) => q.id, ['a']);
    }),
  );
  query.andWhereTyped<T>((q) => q.eventType, '=', { eventType: 'class' });
}
void byEventType;

// @ts-expect-error the root is the aliases now, not the entity
typed.whereTyped((q) => q.customerId, '=', 'c');
// @ts-expect-error not an alias of the root
typed.andWhereTyped((q) => q.ticket.id, '=', 'c');
// @ts-expect-error a number for a string column (strictParams is on in these type tests)
typed.whereTyped((q) => q.event.eventType, '=', 1);

// a builder without an entity type, as dataSource.createQueryBuilder() gives
declare const anyQuery: SelectQueryBuilder<any>;

anyQuery.typed<Joins>().whereTyped((q) => q.event.eventType, '=', 'class');
// @ts-expect-error not a property of the root
anyQuery.typed<Joins>().whereTyped((q) => q.event.notAColumn, '=', 'class');

// a marked builder goes where the builder of its entity does
const ofEntity: SelectQueryBuilder<CheckIn> = typed;
void ofEntity;

// from() and addFrom() type the builder by their entity and keep the root, set before or after them
anyQuery.from(CheckIn, 'checkin').typed<Joins>().whereTyped((q) => q.checkin.customerId, '=', 'c');
const fromAfterRoot = anyQuery.typed<Joins>().from(CheckIn, 'checkin');
fromAfterRoot.whereTyped((q) => q.checkin.customerId, '=', 'c');
const fromAfterRootEntities: Promise<CheckIn[]> = fromAfterRoot.getMany();
void fromAfterRootEntities;
anyQuery.typed<Joins>().from('check_ins', 'checkin').addFrom(Event, 'event').andWhereTyped((q) => q.event.id, '=', 'e');
// @ts-expect-error not a property of the root, which a subquery in FROM keeps too
anyQuery.typed<Joins>().from((sub) => sub.from(Event, 'e'), 'event').andWhereTyped((q) => q.event.notAColumn, '=', 'e');
// @ts-expect-error not a property of the root
anyQuery.typed<Joins>().from(CheckIn, 'checkin').addFrom((sub) => sub.from(Event, 'e'), 'event').orderByTyped((q) => q.event.notAColumn);
// @ts-expect-error from() keeps the root, not the entity's properties
anyQuery.typed<Joins>().from(CheckIn, 'checkin').whereTyped((q) => q.customerId, '=', 'c');
// without typed() from() gives the builder of its entity, as before
anyQuery.from(CheckIn, 'checkin').whereTyped((q) => q.customerId, '=', 'c');
// a subquery is a query of its own: it starts without the root of the outer one
// @ts-expect-error not a key of the subquery's entity
typed.subQuery().from(CheckIn, 'inner').whereTyped((q) => q.checkin.id, '=', 'c');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// a builder without an entity type casts to the builder of the rows it selects, marked or not
type CustomerRow = { customerId: string; visits: number };

const customerRows = anyQuery.typed<Joins>().select('checkin.customerId', 'customerId') as SelectQueryBuilder<CustomerRow>;
const subQueryRows = checkIns.subQuery().typed<Joins>().select('checkin.customerId') as SelectQueryBuilder<CustomerRow>;
void customerRows;
void subQueryRows;
// @ts-expect-error a builder of an entity doesn't cast to unrelated rows, marked or not
void (typed as SelectQueryBuilder<CustomerRow>);
// and casts to the builder of rows it has the columns of, marked or not
void (checkIns as SelectQueryBuilder<Pick<CheckIn, 'customerId'>>);
void (typed as SelectQueryBuilder<Pick<CheckIn, 'customerId'>>);

// a helper generic over the entity takes a marked builder, its type argument the entity
declare function entityOf<T extends ObjectLiteral>(query: SelectQueryBuilder<T>): T;

function sortedById<T extends ObjectLiteral>(query: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
  return query.orderBy(`${query.alias}.id`);
}

const markedEntity = entityOf(typed);
const helperEntity: Equal<typeof markedEntity, CheckIn> = true;
const sorted: SelectQueryBuilder<CheckIn> = sortedById(typed);
void helperEntity;
void sorted;

// and sets a root itself, which its calls use
function ofEventType<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, type: string): SelectQueryBuilder<T> {
  return query.typed<Joins>().andWhereTyped((q) => q.event.eventType, '=', type);
}
void ofEventType;

// the root carries through the methods of this library too (q.checkin is a key of the root only)
typed.selectTyped((q) => q.event.id, 'eventId').andWhereTyped((q) => q.checkin.customerId, '=', 'c');
typed.addSelectTyped((q) => q.event.id, 'eventId').andWhereTyped((q) => q.checkin.customerId, '=', 'c');
typed.leftJoinTyped((q) => q.checkin.event, 'event').andWhereTyped((q) => q.checkin.customerId, '=', 'c');
typed.innerJoinAndSelectTyped((q) => q.checkin.event, 'event').andWhereTyped((q) => q.checkin.customerId, '=', 'c');
typed.orderByTyped((q) => q.event.id).addOrderByTyped((q) => q.checkin.id).andWhereTyped((q) => q.checkin.id, '=', 'c');
typed.distinctOnTyped((q) => q.event.id).andWhereTyped((q) => q.checkin.customerId, '=', 'c');
typed.whereIsIn('checkin.id', ['a']).andWhereIsNotIn('event.id', []).andWhereTyped((q) => q.checkin.id, '=', 'c');
typed.whereIsAny('checkin.id', ['a']).andWhereIsNotAny('event.id', []).andWhereTyped((q) => q.checkin.id, '=', 'c');
typed.applyOrder({ field: 'checkin.id' }).applyPagination({ page: 1 }).andWhereTyped((q) => q.checkin.id, '=', 'c');

// the root import loads getManyWithCursor too: a builder still goes where SelectQueryBuilder<ObjectLiteral> does
declare function countRows(query: SelectQueryBuilder<ObjectLiteral>): Promise<number>;

function keepRoot<Q extends SelectQueryBuilder<ObjectLiteral>>(query: Q): Q {
  return query;
}

void countRows(checkIns);
void countRows(typed);
void countRows(anyQuery.typed<Joins>().from(CheckIn, 'checkin'));
keepRoot(typed).andWhereTyped((q) => q.event.eventType, '=', 'class');

// and orders by the properties of the builder's entity, marked or not
const cursorPage = typed.getManyWithCursor({ pageSize: 10 }, { orderBy: [{ field: 'customerId', direction: 'DESC' }] });
const cursorList: Equal<Awaited<typeof cursorPage>['list'], CheckIn[]> = true;
void cursorList;
void checkIns.getManyWithCursor(null, { orderBy: [{ field: 'id' }] });
// @ts-expect-error not a property of the entity
void typed.getManyWithCursor(null, { orderBy: [{ field: 'eventType' }] });
// @ts-expect-error not a property of the entity
void checkIns.getManyWithCursor(null, { orderBy: [{ field: 'eventType' }] });
