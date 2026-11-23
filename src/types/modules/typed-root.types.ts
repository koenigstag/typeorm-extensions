import type { ObjectLiteral } from 'typeorm';

// an optional method of a class: a type without it is assignable to the marked one and back, so a marked builder
// goes wherever the unmarked one does; `{ ...entity }` drops class methods, so declaration files never name it on a
// marked entity (TS4053 / TS4058). A string key: a symbol in `keyof Entity` isn't in `keyof ObjectLiteral`
// (string | number), which kept a builder of a marked entity from SelectQueryBuilder<ObjectLiteral>
declare class TypedRootMark<Root> {
  __typedRoot?(): Root;
}

/**
 * A query builder whose typed callbacks take another root, as `typed<Root>()` returns it:
 * `WithTypedRoot<SelectQueryBuilder<Entity>, Root>`, the builder with an optional `__typedRoot` method that only
 * types carry. A builder of a marked entity, `SelectQueryBuilder<WithTypedRoot<Entity, Root>>`, takes the root too.
 */
export type WithTypedRoot<Marked, Root extends ObjectLiteral> = Marked & TypedRootMark<Root>;

type IsAny<T> = 0 extends 1 & T ? true : false;

// a builder has no index signature: the mark is the only `__typedRoot` key it can have
type BuilderRoot<Builder> = '__typedRoot' extends keyof Builder
  ? Builder extends TypedRootMark<infer Root>
    ? Root extends ObjectLiteral
      ? Root
      : never
    : never
  : never;

// a string index signature (ObjectLiteral) has the key too, as `any`: such an entity is read as unmarked
type EntityRoot<Entity> = '__typedRoot' extends keyof Entity
  ? IsAny<Entity['__typedRoot' & keyof Entity]> extends true
    ? Entity
    : Entity extends TypedRootMark<infer Root>
      ? Root extends ObjectLiteral
        ? Root
        : Entity
      : Entity
  : Entity;

/**
 * The root of a builder's typed callbacks: the one set with `typed<Root>()` on the builder (`Builder`, which the
 * typed methods pass as `this`) or on its entity, or else the entity.
 */
export type TypedRoot<Entity, Builder = unknown> = [BuilderRoot<Builder>] extends [never]
  ? EntityRoot<Entity>
  : BuilderRoot<Builder>;
