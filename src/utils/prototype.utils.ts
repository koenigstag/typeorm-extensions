/* eslint-disable @typescript-eslint/no-explicit-any */

export type PatchPrototypeOptions = {
  /** Leave a method the target already has, own or inherited: TypeORM's, or another library's. */
  onlyMissing?: boolean;
};

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
