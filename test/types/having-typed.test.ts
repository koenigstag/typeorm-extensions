import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

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
