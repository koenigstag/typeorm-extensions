import { faker } from '@faker-js/faker';
import { UserEntity } from '../models/user.entity';
import { ImageEntity } from '../models/image.entity';

export const createEmail = (id: number): string => `u${id}@email.com`;

export const createRandomId = (min?: number, max?: number): number => {
  return faker.number.int({ min: min ?? 1, max: max ?? 1000 });
}

// users.email is UNIQUE, and faker emails collide often enough to fail a seed now and then
// (e.g. `Olaf54@mail.com` twice in one batch), so append a sequence number
let fakeEmailSequence = 0;

export const createFakeUser = (
  overrides: Partial<UserEntity> = {},
): UserEntity => {
  const user = new UserEntity({
    email: faker.internet
      .email({
        provider: 'mail.com',
      })
      .replace('@', `.${++fakeEmailSequence}@`),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    metadata: {
      role: faker.helpers.arrayElement(['admin', 'user', 'moderator']),
      settings: {
        theme: faker.helpers.arrayElement(['light', 'dark']),
        status: faker.helpers.arrayElement(['active', 'inactive']),
      },
    },
  });

  Object.assign(user, overrides);

  return user;
};

export const createFakeUsers = async (
  props: {
    count: number,
    getOverrides?: (
      index: number,
    ) => Partial<UserEntity> | Promise<Partial<UserEntity>>;
    afterCreate?: (user: UserEntity) => void | Promise<void>;
  },
): Promise<UserEntity[]> => {
  const users: UserEntity[] = [];

  for (let i = 0; i < props.count; i++) {
    const userOverrides = (await props?.getOverrides?.(i)) ?? { id: i + 1 };

    const user = createFakeUser(userOverrides);

    await props?.afterCreate?.(user);

    users.push(user);
  }

  return users;
};

export const createFakeImage = (
  overrides: Partial<ImageEntity> = {},
): ImageEntity => {
  const image = new ImageEntity({
    id: faker.number.int({ min: 1, max: 1000 }),
    url: faker.image.url(),
    userId: faker.number.int({ min: 1, max: 1000 }),
  });

  Object.assign(image, overrides);

  return image;
};

export const createFakeImages = async (
  props: {
    count: number,
    getOverrides?: (
      index: number,
    ) => Partial<ImageEntity> | Promise<Partial<ImageEntity>>;
    afterCreate?: (image: ImageEntity) => void | Promise<void>;
  },
): Promise<ImageEntity[]> => {
  const images: ImageEntity[] = [];

  for (let i = 0; i < props.count; i++) {
    const imageOverrides = (await props?.getOverrides?.(i)) ?? { id: i + 1 };

    const image = createFakeImage(imageOverrides);

    await props?.afterCreate?.(image);

    images.push(image);
  }

  return images;
};
