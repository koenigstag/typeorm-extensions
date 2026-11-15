import { tableHelper } from 'typeorm-extensions';

class Image {
  id: number;
  url: string;
  createdAt: Date;
}

const image = tableHelper<Image>('image');

image.jsonBuildObject(['id', 'url']);
image.jsonBuildObject({ imageId: 'id', src: 'url' });
image.jsonAgg(image.column('url'), { orderBy: ['createdAt', 'DESC'] });
image.jsonAgg(image.column('url'), { orderBy: 'id' });

// @ts-expect-error not a column of the entity
image.jsonBuildObject(['id', 'path']);
// @ts-expect-error a key mapped to a column the entity doesn't have
image.jsonBuildObject({ src: 'path' });
// @ts-expect-error ordered by a column the entity doesn't have
image.jsonAgg(image.column('url'), { orderBy: ['position', 'DESC'] });
// @ts-expect-error not a direction
image.jsonAgg(image.column('url'), { orderBy: ['id', 'UP'] });

interface Address {
  city: string;
  geo?: { lat: number; lng: number };
}

class Profile {
  address: Address;
  tags: string[];
  meta: Record<string, unknown>;
  extra: unknown;
  birthday: Date;
}

class Person {
  id: number;
  profile: Profile | null;
  settings: { theme: string };
  free: Record<string, unknown>;
  anything: object;
}

const person = tableHelper<Person>('person');

// interface and class types are checked like type aliases
person.jsonColumn('profile', '->>', 'address', 'city');
person.jsonColumn('profile', '->', 'address', 'geo');
person.jsonColumn('profile', '->>', 'address', 'geo', 'lat');
person.jsonPath('profile', '->>', 'tags');
person.jsonColumn('settings', '->>', 'theme');
// unknown values, records of unknown and bare objects take any keys below them
person.jsonColumn('profile', '->>', 'meta', 'any', 'depth');
person.jsonColumn('profile', '->>', 'extra', 'anything');
person.jsonColumn('free', '->>', 'a', 'b');
person.jsonColumn('anything', '->>', 'a', 'b');

// @ts-expect-error not a key of the interface
person.jsonColumn('profile', '->>', 'address', 'town');
// @ts-expect-error not a key of the class
person.jsonPath('profile', '->>', 'adress');
// @ts-expect-error a date has no keys
person.jsonColumn('profile', '->>', 'birthday', 'year');
// @ts-expect-error an array's items have no keys
person.jsonColumn('profile', '->>', 'tags', 'length');

type JobRule = { kind: 'reminder'; remindAt: string } | { kind: 'alert'; threshold: { value: number } };

class Job {
  rules: JobRule;
}

const job = tableHelper<Job>('job');

// a union takes the keys of any of its members
job.jsonColumn('rules', '->>', 'kind');
job.jsonColumn('rules', '->>', 'remindAt');
job.jsonColumn('rules', '->>', 'threshold', 'value');
// @ts-expect-error a key of no member
job.jsonColumn('rules', '->>', 'remindOn');
// @ts-expect-error a key of no member, one level down
job.jsonColumn('rules', '->>', 'threshold', 'limit');
