import type { ObjectLiteral } from 'typeorm';

declare const typedRoot: unique symbol;

// a method of a class: TypeScript leaves those out of `{ ...entity }`, so a declaration file never
// has to name the symbol, which would fail with TS4053 / TS4058
declare class TypedRootMark<Root> {
  [typedRoot]?(): Root;
}

/**
 * The entity type of a builder whose typed callbacks take another root, set with `typed<Root>()`: the entity
 * with an optional symbol method that only types carry. Entities loaded with it are plain entities.
 */
export type WithTypedRoot<Entity, Root extends ObjectLiteral> = Entity & TypedRootMark<Root>;

/**
 * The root of a builder's typed callbacks: the one set with `typed<Root>()`, or else its entity. The key check
 * comes first: without `strictNullChecks` an entity with an index signature (`ObjectLiteral`) matches the
 * optional mark too, and its root would be inferred as `unknown`.
 */
export type TypedRoot<Entity> = typeof typedRoot extends keyof Entity
  ? Entity extends TypedRootMark<infer Root>
    ? Root extends ObjectLiteral
      ? Root
      : Entity
    : Entity
  : Entity;
