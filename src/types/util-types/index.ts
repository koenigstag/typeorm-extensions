/* eslint-disable @typescript-eslint/no-explicit-any */
export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T] &
	string;
export type NonFunctionPropertyNames<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T] &
	string;
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
