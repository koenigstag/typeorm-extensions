import { DataSource, SelectQueryBuilder } from 'typeorm';
import { tableHelper } from 'typeorm-extensions';

class Ticket {
  id: number;
  status: string;
}

class User {
  id: number;
  name: string;
}

const ticket = tableHelper<Ticket>('ticket');
declare const ids: number[];

ticket.isIn('id', ids, 'ids');
ticket.isNotIn('status', null, 'statuses');
ticket.isAny('id', ids, 'ids', 'int[]');
ticket.isNotAny('id', undefined, 'ids');

// @ts-expect-error not a column of the entity
ticket.isIn('ownerId', ids, 'ids');
// @ts-expect-error the parameter name is required
ticket.isIn('id', ids);

declare const users: SelectQueryBuilder<User>;
declare const dataSource: DataSource;

users.andWhereExists((sub) => sub.select('1').from(Ticket, 'ticket'));
users.orWhereNotExists((sub) => sub.select('1').from(Ticket, 'ticket'));
users.whereExists(dataSource.getRepository(Ticket).createQueryBuilder('ticket'));
dataSource.createQueryBuilder().update(User).set({ name: 'x' }).whereNotExists((sub) => sub.select('1').from(Ticket, 'ticket'));

// @ts-expect-error a factory returns the subquery
users.andWhereExists((sub) => 'EXISTS (SELECT 1)');
