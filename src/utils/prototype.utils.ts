/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeleteQueryBuilder, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';

export type PatchPrototypeOptions = {
  /** Leave a method the target already has, own or inherited: TypeORM's, or another library's. */
  onlyMissing?: boolean;
};

/** The query builders with a WHERE clause, which the where extensions patch. */
export const WHERE_QUERY_BUILDERS = [SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder, SoftDeleteQueryBuilder];

export function patchPrototype<
  T extends { prototype: any },
  S extends { prototype: any }
>(target: T, source: S, options: PatchPrototypeOptions = {}): void {
  for (const method of Object.keys(source.prototype)) {
    if (options.onlyMissing && method in target.prototype) {
      continue;
    }

    target.prototype[method] = source.prototype[method];
  }
}

export function patchPrototypes<S extends { prototype: any }>(
  targets: ReadonlyArray<{ prototype: any }>,
  source: S,
  options?: PatchPrototypeOptions
): void {
  for (const target of targets) {
    patchPrototype(target, source, options);
  }
}
