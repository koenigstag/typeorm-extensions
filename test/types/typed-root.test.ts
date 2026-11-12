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

// a marked builder goes where the builder of its entity does (SelectQueryBuilder<ObjectLiteral>: typed-imports/)
const ofEntity: SelectQueryBuilder<CheckIn> = typed;
void ofEntity;

// from() types the builder by its entity again, so typed() goes after it
anyQuery.from(CheckIn, 'checkin').typed<Joins>().whereTyped((q) => q.checkin.customerId, '=', 'c');
// @ts-expect-error the root set before from() is gone
anyQuery.typed<Joins>().from(CheckIn, 'checkin').whereTyped((q) => q.checkin.customerId, '=', 'c');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// a builder without an entity type casts to the builder of the rows it selects, marked or not
type CustomerRow = { customerId: string; visits: number };

const customerRows = anyQuery.typed<Joins>().select('checkin.customerId', 'customerId') as SelectQueryBuilder<CustomerRow>;
const subQueryRows = checkIns.subQuery().typed<Joins>().select('checkin.customerId') as SelectQueryBuilder<CustomerRow>;
void customerRows;
void subQueryRows;
// @ts-expect-error a builder of an entity doesn't cast to unrelated rows, marked or not
void (typed as SelectQueryBuilder<CustomerRow>);

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
typed.applyOrder({ field: 'checkin.id' }).applyPaginationFilter({ page: 1 }).andWhereTyped((q) => q.checkin.id, '=', 'c');
