import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';

class User {
  id: number;
  imagesCount?: number;
}

declare const users: SelectQueryBuilder<User>;

users.addSelectCalculated('COUNT(*)', 'imagesCount');
users.addSelectCalculated('COUNT(*)', 'imagesCount', 'owner');

// @ts-expect-error not a property of the entity
users.addSelectCalculated('COUNT(*)', 'imageCount');
