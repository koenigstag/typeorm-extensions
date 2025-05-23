/* eslint-disable @typescript-eslint/no-explicit-any */

export function patchPrototype<
  T extends { prototype: any },
  S extends { prototype: any }
>(target: T, source: S): void {
  for (const method in Object.keys(source.prototype)) {
    target.prototype[method] = source.prototype[method];
  }
}
