import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';
import type { Json } from 'typeorm-extensions';

interface ExecutionDetails {
  outcome: string;
  meta: {
    endTs: number;
    tags: string[];
    at?: Date;
  };
  attempts?: number;
}

class Owner {
  id: string;
  profile: Json<{ address: { city: string } }>;
  executions: Execution[];
}

class Execution {
  id: string;
  details: Json<ExecutionDetails>;
  maybeDetails: Json<ExecutionDetails> | null;
  list: Json<string[]>;
  plain: ExecutionDetails;
  owner: Owner;
}

declare const qb: SelectQueryBuilder<Execution>;

// a Json<> column is open at any depth, and the leaf type is checked (strictParams is on in this program)
qb.whereTyped((q) => q.details.outcome, '=', 'executed');
qb.andWhereTyped((q) => q.details.meta.endTs, '>=', { endTime: 1 });
qb.whereTyped((q) => q.maybeDetails.meta.endTs, '<', 5);
qb.whereTyped((q) => q.details.attempts, 'IS NULL');
qb.whereIsInTyped((q) => q.details.outcome, ['a', 'b']);
qb.whereTyped((q) => q.details.meta.at, '<', new Date());
// @ts-expect-error a string for a number inside the JSON
qb.whereTyped((q) => q.details.meta.endTs, '>=', '1');
// @ts-expect-error not a key of the JSON
qb.whereTyped((q) => q.details.meta.missing, '=', 1);

// arrays are values, not objects to go into
qb.whereTyped((q) => q.details.meta.tags, '=', ['a']);
qb.whereTyped((q) => q.list, '=', ['a']);

// without Json<> a JSON column stops at alias.column, like a relation
qb.whereTyped((q) => q.plain.outcome, '=', 'a');
// @ts-expect-error 3 levels into an unmarked column
qb.whereTyped((q) => q.plain.meta.endTs, '=', 1);

// a Json<> column of a related entity, joined by its alias
qb.whereTyped<{ o: Owner }>((q) => q.o.profile.address.city, '=', 'x');
qb.whereTyped((q) => q.owner.profile.address.city, '=', 'x');
// @ts-expect-error a relation of a relation: still 3 levels
qb.whereTyped((q) => q.owner.executions.details, '=', 'x');

// values are assignable both ways
declare const execution: Execution;
const details: ExecutionDetails = execution.details;
execution.details = { outcome: 'a', meta: { endTs: 1, tags: [] } };
execution.maybeDetails = details;
