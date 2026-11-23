import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

class Event {
  id: string;
  eventType: string;
  checkIns?: CheckIn[];
}

class CheckIn {
  id: string;
  customerId: string;
  event: Event;
  // filled by a map join, not a relation
  latestEvent?: Event | null;
  recentVisits?: CheckIn[];
}

type Joins = { checkin: CheckIn; event: Event };

declare const checkIns: SelectQueryBuilder<CheckIn>;
declare const anyQuery: SelectQueryBuilder<any>;

// the entity is the root without typed(), and any of its properties takes the mapped data, not only relations
checkIns.leftJoinAndMapOneTyped((c) => c.latestEvent, Event, 'latest', 'latest.id = checkin.eventId');
checkIns.innerJoinAndMapOneTyped((c) => c.event, 'event', 'e');
checkIns.leftJoinAndMapManyTyped((c) => c.recentVisits, 'check_ins', 'visit', 'visit.customerId = :customerId', { customerId: 'c' });
checkIns.innerJoinAndMapManyTyped((c) => c.recentVisits, CheckIn, 'visit');

// a subquery factory, its builder typed as in TypeORM's map joins
checkIns.leftJoinAndMapOneTyped(
  (c) => c.latestEvent,
  (qb) => qb.select('e.id', 'id').from(Event, 'e').limit(1),
  'latest',
  'latest.id = checkin.eventId',
);

// typed() sets the root, a property of a joined alias needs no type argument
const typed = checkIns.leftJoin('checkin.event', 'event').typed<Joins>();

typed.leftJoinAndMapManyTyped((q) => q.event.checkIns, CheckIn, 'other', 'other.eventId = event.id');
typed.innerJoinAndMapOneTyped((q) => q.checkin.latestEvent, Event, 'latest');
anyQuery.typed<Joins>().from(CheckIn, 'checkin').leftJoinAndMapOneTyped((q) => q.checkin.latestEvent, Event, 'latest');

// the builder is returned, its root kept for the calls after it
const kept: typeof typed = typed.leftJoinAndMapOneTyped((q) => q.checkin.latestEvent, Event, 'latest');
kept.andWhereTyped((q) => q.event.eventType, '=', 'class');
const loaded: Promise<CheckIn[]> = typed.leftJoinAndMapOneTyped((q) => q.checkin.latestEvent, Event, 'latest').getMany();
void loaded;

// an explicit root still wins
checkIns.leftJoinAndMapManyTyped<Joins>((q) => q.event.checkIns, CheckIn, 'other');

// @ts-expect-error not a property of the entity
checkIns.leftJoinAndMapOneTyped((c) => c.notAProperty, Event, 'latest');
// @ts-expect-error not a property of the joined alias
typed.leftJoinAndMapOneTyped((q) => q.event.notAProperty, Event, 'latest');
// @ts-expect-error the root is the aliases now, not the entity
typed.leftJoinAndMapOneTyped((q) => q.latestEvent, Event, 'latest');
// @ts-expect-error a key is `property` or `alias.property`
typed.leftJoinAndMapOneTyped((q) => q.checkin.event.id, Event, 'latest');
// @ts-expect-error the joined data is an entity, a table, a relation or a subquery factory
checkIns.leftJoinAndMapOneTyped((c) => c.latestEvent, 1, 'latest');
