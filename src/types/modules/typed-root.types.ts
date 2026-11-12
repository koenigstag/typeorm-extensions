import type { ObjectLiteral } from 'typeorm';

// an optional method of a class: an entity without it is assignable to the marked one and back, so a marked builder
// goes wherever the builder of its entity does; `{ ...entity }` drops class methods, so declaration files never
// name it (TS4053 / TS4058). A string key: a symbol in `keyof Entity` isn't in `keyof ObjectLiteral` (string | number),
// which kept the builder from SelectQueryBuilder<ObjectLiteral>
declare class TypedRootMark<Root> {
  __typedRoot?(): Root;
}

/**
 * The entity type of a builder whose typed callbacks take another root, set with `typed<Root>()`: the entity
 * with an optional `__typedRoot` method that only types carry. Entities loaded with it are plain entities.
 */
export type WithTypedRoot<Entity, Root extends ObjectLiteral> = Entity & TypedRootMark<Root>;

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * The root of a builder's typed callbacks: the one set with `typed<Root>()`, or else its entity. A string index
 * signature (`ObjectLiteral`) has the key too, as `any`: such an entity is read as unmarked.
 */
export type TypedRoot<Entity> = '__typedRoot' extends keyof Entity
  ? IsAny<Entity['__typedRoot' & keyof Entity]> extends true
    ? Entity
    : Entity extends TypedRootMark<infer Root>
      ? Root extends ObjectLiteral
        ? Root
        : Entity
      : Entity
  : Entity;
