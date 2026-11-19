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

// json / jsonText: the path as a callback
person.jsonText((p) => p.profile.address.city);
person.json((p) => p.profile.address.geo);
person.jsonText((p) => p.profile.address.geo.lat);
person.jsonText((p) => p.profile.tags[0]);
person.jsonText((p) => p.profile.meta.any.depth);
person.jsonText((p) => p.profile.extra.anything);
person.jsonText((p) => p.free.a.b);
person.jsonText((p) => p.anything.a.b);
// @ts-expect-error not a key of the interface
person.jsonText((p) => p.profile.address.street);
// @ts-expect-error a string has no keys
person.jsonText((p) => p.profile.address.city.length);
// @ts-expect-error a Date ends the path
person.jsonText((p) => p.profile.birthday.getTime);
// @ts-expect-error not a column of the entity
person.jsonText((p) => p.missing.key);

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

class Tree {
  root: { a: { b: { c: { d: { leaf: string } } } } };
}

const tree = tableHelper<Tree>('tree');

// a path is checked to its end, however deep
tree.jsonColumn('root', '->>', 'a', 'b', 'c', 'd', 'leaf');
// @ts-expect-error a wrong key five levels down
tree.jsonColumn('root', '->>', 'a', 'b', 'c', 'd', 'leaves');
// @ts-expect-error a typed column needs a key
person.jsonColumn('profile', '->>');
