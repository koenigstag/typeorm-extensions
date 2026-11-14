import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
// the typed extensions alone, without the rest of the root import
import '../../../src/extensions/typed';
import type { TypedRoot, WithTypedRoot } from '../../../src/types/modules/typed-root.types';

class Event {
  id: string;
  eventType: string;
}

class CheckIn {
  id: string;
  customerId: string;
  event: Event;
}

class WithIndex {
  id: number;
  [key: string]: unknown;
}

type Joins = { checkin: CheckIn; event: Event };
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

declare const checkIns: Repository<CheckIn>;
declare const anyQuery: SelectQueryBuilder<any>;
declare function countRows(query: SelectQueryBuilder<ObjectLiteral>): Promise<number>;

const typed = checkIns.createQueryBuilder('checkin').typed<Joins>();

// a marked builder goes wherever the builder of its entity does
void countRows(checkIns.createQueryBuilder('checkin'));
void countRows(typed);
void countRows(anyQuery.typed<Joins>());
const ofEntity: SelectQueryBuilder<CheckIn> = typed;
void ofEntity;

function pageQuery(): SelectQueryBuilder<ObjectLiteral> {
  return anyQuery.from(CheckIn, 'checkin').typed<Joins>().whereTyped((q) => q.event.eventType, '=', 'class');
}
void pageQuery;

// a string index signature has the mark's key too, as `any`: it isn't read as a mark
const literalRoot: Equal<TypedRoot<ObjectLiteral>, ObjectLiteral> = true;
const indexRoot: Equal<TypedRoot<WithIndex>, WithIndex> = true;
const markedIndexRoot: Equal<TypedRoot<WithTypedRoot<WithIndex, Joins>>, Joins> = true;
void literalRoot;
void indexRoot;
void markedIndexRoot;

// typed() marks the builder; a helper that takes and returns the builder's own type keeps the mark
const builderRoot: Equal<TypedRoot<CheckIn, typeof typed>, Joins> = true;
const unmarkedBuilderRoot: Equal<TypedRoot<CheckIn, SelectQueryBuilder<CheckIn>>, CheckIn> = true;
void builderRoot;
void unmarkedBuilderRoot;

function keepRoot<Q extends SelectQueryBuilder<ObjectLiteral>>(query: Q): Q {
  return query;
}
keepRoot(typed).andWhereTyped((q) => q.event.eventType, '=', 'class');
// @ts-expect-error not a key of the root
keepRoot(typed).andWhereTyped((q) => q.customerId, '=', 'c');

// the typed map joins come with the typed extensions too
keepRoot(typed).leftJoinAndMapOneTyped((q) => q.checkin.event, Event, 'e').andWhereTyped((q) => q.event.eventType, '=', 'class');
// @ts-expect-error not a key of the root
typed.leftJoinAndMapManyTyped((q) => q.customerId, CheckIn, 'other');
