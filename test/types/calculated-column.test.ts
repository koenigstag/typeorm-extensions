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

users.orderByCalculated('imagesCount', 'DESC').addOrderByCalculated('imagesCount');
users.orderByCalculated('imagesCount', 'ASC', 'NULLS LAST', 'owner');

// @ts-expect-error not a property of the entity
users.orderByCalculated('imageCount');

users.addSelectCalculatedTyped('COUNT(*)', (user) => user.imagesCount);
users.orderByTyped((user) => user.imagesCount, 'DESC').addOrderByTyped((user) => user.imagesCount);

// @ts-expect-error not a property of the entity
users.addSelectCalculatedTyped('COUNT(*)', (user) => user.imageCount);

class Image {
  id: number;
  owner?: User;
}

declare const images: SelectQueryBuilder<Image>;

images.typed<{ image: Image; owner: User }>().addSelectCalculatedTyped('COUNT(*)', (q) => q.owner.imagesCount);
images.addSelectCalculatedTyped<{ image: Image; owner: User }>(
  (qb) => qb.select('COUNT(*)').from(Image, 'counted'),
  (q) => q.owner.imagesCount,
);

// @ts-expect-error not a property of the joined entity
images.typed<{ image: Image; owner: User }>().orderByTyped((q) => q.owner.imageCount);
