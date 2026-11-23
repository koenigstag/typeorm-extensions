import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';
import type { WithTypedRoot } from '../../src/types/modules/typed-root.types';

interface IntakeSettings {
  enabled: boolean;
}

class Event {
  id: string;
  eventType: string;
  intakeSettings?: IntakeSettings;
}

class CheckIn {
  id: string;
  customerId: string;
  event: Event;
}

type Joins = { checkin: CheckIn; event: Event };

declare const checkIns: SelectQueryBuilder<CheckIn>;
// what typed<Joins>() returns
declare const typed: SelectQueryBuilder<WithTypedRoot<CheckIn, Joins>>;

checkIns.groupByTyped((c) => c.customerId);
checkIns.addGroupByTyped((c) => [c.id, c.event.eventType]);
checkIns.groupByTyped<Joins>((q) => q.event.id);

typed.groupByTyped((q) => q.checkin.customerId);
typed.addGroupByTyped((q) => [q.checkin.id, q.event.eventType]);

// @ts-expect-error not a property of the entity
checkIns.groupByTyped((c) => c.ticket);
// @ts-expect-error the root is the aliases now, not the entity
typed.groupByTyped((q) => q.customerId);
// a JSON column is grouped as a whole, on the main alias or a joined one; relations are checked at runtime
checkIns.groupByTyped<Event>((e) => e.intakeSettings);
checkIns.addGroupByTyped<Joins>((q) => [q.checkin.id, q.event.intakeSettings]);
