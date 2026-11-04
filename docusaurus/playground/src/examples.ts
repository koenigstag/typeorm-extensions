export type Example = { id: string; title: string; code: string };

const example = (id: string, title: string, code: string): Example => ({
  id,
  title,
  code: code.trim() + '\n',
});

export const examples: Example[] = [
  example(
    'typed',
    'Typed select, join and where',
    `
import 'typeorm-extensions';
import { dataSource, User } from 'playground';

// Typed callbacks: try typing \`u.\` to see the properties of User,
// or a misspelled property to see the error.
export default dataSource
  .getRepository(User)
  .createQueryBuilder('user')
  .leftJoinAndSelectTyped((u) => u.images, 'images')
  .whereTyped((u) => u.firstName, 'IN', ['Ann', 'Bob', 'Dave'])
  .andWhereTyped((u) => u.images.url, 'IS NOT NULL')
  .orderByTyped((u) => u.createdAt, 'DESC');
`,
  ),
  example(
    'period',
    'Period filter',
    `
import 'typeorm-extensions';
import { dataSource, User } from 'playground';

// A date-only periodTo includes the whole day: Carol signed up on January 31st at 18:45.
// Missing ends are skipped, so a filter from query parameters can be applied as is.
export default dataSource
  .getRepository(User)
  .createQueryBuilder('user')
  .applyPeriodFilterTyped((u) => u.createdAt, {
    periodFrom: '2024-01-01',
    periodTo: '2024-01-31',
  });
`,
  ),
  example(
    'cursor',
    'Keyset (cursor) pagination',
    `
import 'typeorm-extensions';
import { dataSource, User } from 'playground';

const users = () => dataSource.getRepository(User).createQueryBuilder('user');
const options = { orderBy: [{ field: 'createdAt' as const, direction: 'DESC' as const }] };

// Load two pages: the second one continues after the last row of the first.
export default async () => {
  const first = await users().getManyWithCursor({ pageSize: 2 }, options);
  const second = await users().getManyWithCursor({ cursor: first.nextCursor, pageSize: 2 }, options);

  return {
    first: first.list.map((u) => u.firstName),
    second: second.list.map((u) => u.firstName),
    nextCursor: second.nextCursor,
  };
};
`,
  ),
  example(
    'totals',
    'Page with totals',
    `
import 'typeorm-extensions';
import { dataSource, User } from 'playground';

// page 2 of 3, and the total of 6 users;
// createdAt is ordered by its column, created_at
export default dataSource
  .getRepository(User)
  .createQueryBuilder('user')
  .applyOrderFilter({ orderBy: [{ field: 'createdAt', direction: 'desc' }] })
  .getManyWithTotals({ page: 2, pageSize: 2 });
`,
  ),
  example(
    'any',
    'whereIsAny + orderByArrayPosition',
    `
import 'typeorm-extensions';
import { dataSource, User } from 'playground';

// ids ranked somewhere else (e.g. by a search engine): load them in that order
const rankedIds = [5, 2, 4];

export default dataSource
  .getRepository(User)
  .createQueryBuilder('user')
  .whereIsAnyTyped((u) => u.id, rankedIds)
  .orderByArrayPositionTyped((u) => u.id, rankedIds);
`,
  ),
  example(
    'arrays-json',
    'Array and JSONB operators',
    `
import 'typeorm-extensions';
import { dataSource, Article } from 'playground';

// tags is text[], meta is jsonb
export default dataSource
  .getRepository(Article)
  .createQueryBuilder('article')
  .whereArrayOverlapsTyped((a) => a.tags, ['jsonb', 'sql'])
  .orWhereJsonContainsTyped((a) => a.meta, { author: { name: 'Bob' } });
`,
  ),
  example(
    'distinct-from',
    'Null-safe comparison',
    `
import 'typeorm-extensions';
import { dataSource, Ticket } from 'playground';

// Tickets not owned by user 1, unassigned ones included: \`owner_id <> 1\` would drop them.
// Note the column names: Ticket maps its properties to ticket_status, owner_id.
export default dataSource
  .getRepository(Ticket)
  .createQueryBuilder('ticket')
  .whereIsDistinctFromTyped((t) => t.ownerId, 1);
`,
  ),
  example(
    'returning',
    'UPDATE … RETURNING',
    `
import 'typeorm-extensions';
import { dataSource, Ticket } from 'playground';

// The tables are refilled before every run, so feel free to change data.
export default dataSource
  .getRepository(Ticket)
  .createQueryBuilder()
  .update()
  .set({ status: 'closed' })
  .whereIsNotDistinctFromTyped((t) => t.ownerId, null)
  .returningTyped((t) => [t.id, t.status]);
`,
  ),
  example(
    'table-helper',
    'tableHelper and JSONB paths',
    `
import { tableHelper } from 'typeorm-extensions';
import { dataSource, User } from 'playground';

const u = tableHelper<User>('user');

// SQL fragments with quoted columns, typed JSONB paths and a count
export default dataSource
  .getRepository(User)
  .createQueryBuilder('user')
  .select(u.jsonColumn('metadata', '->>', 'settings', 'theme'), 'theme')
  .addSelect(u.count(), 'users')
  .where(u.isNotNull('metadata'))
  .groupBy('theme')
  .getRawMany();
`,
  ),
];
