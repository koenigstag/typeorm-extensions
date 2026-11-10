import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';
import type { WithTypedRoot } from '../../src/types/modules/typed-root.types';

// strictParams is on for this project (strict-params.test.ts)

class Image {
  id: number;
  url: string;
  createdAt: Date;
}

class Owner {
  id: number;
  images: Image[];
}

declare const owners: SelectQueryBuilder<Owner>;

owners.havingTyped('COUNT', (o) => o.images.id, '>=', 2);
owners.andHavingTyped('COUNT DISTINCT', (o) => o.images.url, '=', { urls: 3 });
owners.orHavingTyped('MAX', (o) => o.images.createdAt, '<', new Date());
owners.havingTyped('COUNT', '*', '>', 5);
owners.havingTyped('SUM', (o) => o.images.id, '= :total', { total: 3 });

// @ts-expect-error a count is a number
owners.havingTyped('COUNT', (o) => o.images.id, '>=', '2');
// @ts-expect-error MAX of a date column is compared with a date
owners.havingTyped('MAX', (o) => o.images.createdAt, '<', 5);
// @ts-expect-error only COUNT takes '*'
owners.havingTyped('SUM', '*', '>', 5);
// @ts-expect-error not an aggregate
owners.havingTyped('MEDIAN', (o) => o.images.id, '>', 5);
// @ts-expect-error not a property of the entity
owners.havingTyped('COUNT', (o) => o.images.path, '>', 5);

// the root set with typed<Root>() reaches the callback, and strictParams still checks the value
declare const typed: SelectQueryBuilder<WithTypedRoot<Owner, { owner: Owner; image: Image }>>;

typed.havingTyped('COUNT', (q) => q.image.id, '>=', 2);
typed.andHavingTyped('MAX', (q) => q.image.createdAt, '<', new Date());

// @ts-expect-error the root is the aliases now, not the entity
typed.havingTyped('COUNT', (q) => q.images.id, '>=', 2);
// @ts-expect-error a count is a number
typed.havingTyped('COUNT', (q) => q.image.id, '>=', '2');

// @ts-expect-error a relation is no column to aggregate
owners.havingTyped('COUNT', (o) => o.images, '>=', 2);
