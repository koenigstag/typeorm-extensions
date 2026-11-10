import { SelectQueryBuilder } from 'typeorm';
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

// without typed() the entity is the root, and an explicit root still wins
checkIns.whereTyped((q) => q.customerId, '=', 'c');
checkIns.whereTyped<Joins>((q) => q.event.eventType, '=', 'class');

// @ts-expect-error the root is the aliases now, not the entity
typed.whereTyped((q) => q.customerId, '=', 'c');
// @ts-expect-error not an alias of the root
typed.andWhereTyped((q) => q.ticket.id, '=', 'c');
// @ts-expect-error a number for a string column (strictParams is on in these type tests)
typed.whereTyped((q) => q.event.eventType, '=', 1);
