/**
 * Compile-time options of the library, switched on by augmenting this interface in your project:
 *
 * ```ts
 * declare module 'typeorm-extensions' {
 *   interface TypeormExtensionsConfig {
 *     strictParams: true;
 *   }
 * }
 * ```
 *
 * - `strictParams`: typed where methods check their value against the type of the column the callback
 *   selects (`whereTyped(q => q.price, '>', '10')` doesn't compile for a `number` column). Applies to calls
 *   without an explicit type argument: `whereTyped<Joins>(…)` keeps unchecked parameters.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TypeormExtensionsConfig {}
