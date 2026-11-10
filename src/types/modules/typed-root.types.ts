import type { ObjectLiteral } from 'typeorm';

declare const typedRoot: unique symbol;

/**
 * The entity type of a builder whose typed callbacks take another root, set with `typed<Root>()`: the entity
 * with an optional symbol property that only types carry. Entities loaded with it are plain entities.
 */
export type WithTypedRoot<Entity, Root extends ObjectLiteral> = Entity & { readonly [typedRoot]?: Root };

/** The root of a builder's typed callbacks: the one set with `typed<Root>()`, or else its entity. */
export type TypedRoot<Entity> = Entity extends { readonly [typedRoot]?: infer Root }
  ? Root extends ObjectLiteral
    ? Root
    : Entity
  : Entity;
