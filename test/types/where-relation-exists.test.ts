import { SelectQueryBuilder } from 'typeorm';
import 'typeorm-extensions';
import type { WithTypedRoot } from '../../src/types/modules/typed-root.types';

class Image {
  id: number;
  url: string;
}

class User {
  id: number;
  name: string;
  images: Image[];
}

declare const users: SelectQueryBuilder<User>;

users.andWhereRelationExists((u) => u.images, 'image', (images) => images.andWhereTyped((i) => i.url, '=', 'x'));
users.orWhereRelationNotExists((u) => u.images, 'image');

// @ts-expect-error not a property of the entity
users.andWhereRelationExists((u) => u.photos, 'image');
// @ts-expect-error the subquery is typed by the related entity
users.andWhereRelationExists((u) => u.images, 'image', (images) => images.andWhereTyped((i) => i.name, '=', 'x'));

// a relation of a joined alias: the related type is given, the root type too
type Joins = { user: User; image: Image };
declare const joined: SelectQueryBuilder<User>;
joined.andWhereRelationExists<Image, Joins>((j) => j.user.images, 'other', (others) => others.andWhereTyped((i) => i.url, '=', 'x'));

// with the root set by typed<Joins>(), only the related type is given
declare const typed: SelectQueryBuilder<WithTypedRoot<User, Joins>>;
typed.andWhereRelationExists<Image>((j) => j.user.images, 'other', (others) => others.andWhereTyped((i) => i.url, '=', 'x'));
// @ts-expect-error the root is the aliases now, not the entity
typed.andWhereRelationExists<Image>((j) => j.images, 'other');
