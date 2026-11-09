import { ObjectLiteral } from "typeorm";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "./relations.types";
import { ColumnValueType } from "./column.types";
import { UnwrapArray } from "../util-types";

export type ProxyColumnValueType = ColumnValueType | ':value';

type ProxyPropertyType<V> = NonNullable<V> extends readonly (infer U)[] ? NonNullable<U> : NonNullable<V>;

/** Objects that are column values, not relations or JSON objects to go into. */
type ProxyLeafObject = Date | ArrayBufferView | ArrayBuffer;

type IsProxyBranch<V> = ProxyPropertyType<V> extends ProxyLeafObject
	? false
	: ProxyPropertyType<V> extends object
		? true
		: false;

declare const jsonColumn: unique symbol;

/**
 * Marks an entity property as a JSON column for typed callbacks, which then go into it at any depth:
 * `(e) => e.details.meta.endTs` is `"e"."details" -> 'meta' ->> 'endTs'` in where methods. Without it a typed key
 * stops at `alias.column` (`e.details.outcome`), as it does for relations. Values are assignable both ways.
 *
 * @example
 * @Column({ type: 'jsonb' })
 * details: Json<ExecutionDetails>;
 */
export type Json<T> = T & { readonly [jsonColumn]?: true };

type IsJsonColumn<V> = typeof jsonColumn extends keyof NonNullable<V> ? true : false;

type IsJsonObject<V> = NonNullable<V> extends ProxyLeafObject | readonly unknown[]
	? false
	: NonNullable<V> extends object
		? true
		: false;

/** Inside a JSON column: objects to go into at any depth, while arrays and dates are values. */
type JsonPathProxy<T> = {
	[K in keyof T as K extends typeof jsonColumn ? never : K]-?: IsJsonObject<T[K]> extends true
		? JsonPathProxy<NonNullable<T[K]>>
		: T[K];
};

type JsonColumnProxy<V> = NonNullable<V> extends readonly unknown[] ? V : JsonPathProxy<NonNullable<V>>;

/**
 * End of a typed key path. Typed keys are `column` or `alias.column` (`relation.column`),
 * so an object at the second level (a nested relation, a JSON sub-object) can be selected
 * as a whole but not dereferenced further: `u => u.images.user.email` is a compile error.
 * Address deeper relations by their join alias with an alias-keyed type instead, and mark
 * JSON columns with {@link Json} to go deeper into them.
 */
export interface KeyPathEnd {
	readonly __keyPathEnd: never;
}

type ProxySecondLevel<T> = {
	[K in keyof T]-?: IsJsonColumn<T[K]> extends true
		? JsonColumnProxy<T[K]>
		: IsProxyBranch<T[K]> extends true
			? KeyPathEnd
			: T[K];
};

/**
 * Type of the proxy passed to typed callbacks: two levels (`column` or `alias.column`),
 * with arrays unwrapped (`user.images.url` for `images: ImageEntity[]`) and optional
 * properties made required. A {@link Json} column is open at any depth.
 */
export type DeepUnwrapArray<T> = {
	[K in keyof T]-?: IsJsonColumn<T[K]> extends true
		? JsonColumnProxy<T[K]>
		: IsProxyBranch<T[K]> extends true
			? ProxySecondLevel<ProxyPropertyType<T[K]>>
			: T[K];
};

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: DeepUnwrapArray<T>) => ProxyColumnValueType | Array<ProxyColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: DeepUnwrapArray<EntityOnlyWithRelations<T>>
) => ProxyColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<UnwrapArray<T>>
) => ProxyColumnValueType;