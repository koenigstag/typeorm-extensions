/* eslint-disable @typescript-eslint/no-explicit-any */

/** Values for IN / NOT IN conditions. Readonly so `as const` arrays are accepted; the array is only read. */
export type ArgsType = readonly unknown[];

export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T] &
	string;
export type NonFunctionPropertyNames<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T] &
	string;
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type UnwrapArray<T> = T extends (infer U)[] ? U : T;
