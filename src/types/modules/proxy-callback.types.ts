import { ObjectLiteral } from "typeorm";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "./relations.types";
import { ColumnValueType } from "./column.types";
import { UnwrapArray } from "../util-types";

export type ProxyColumnValueType = ColumnValueType | ':value';

type ProxyPropertyType<V> = NonNullable<V> extends readonly (infer U)[] ? NonNullable<U> : NonNullable<V>;

/**
 * End of a typed key path. Typed keys are `column` or `alias.column` (`relation.column`),
 * so an object at the second level (a nested relation, a JSON sub-object) can be selected
 * as a whole but not dereferenced further: `u => u.images.user.email` is a compile error.
 * Address deeper relations by their join alias with an alias-keyed type instead.
 */
export interface KeyPathEnd {
	readonly __keyPathEnd: never;
}

type ProxySecondLevel<T> = {
	[K in keyof T]-?: ProxyPropertyType<T[K]> extends object ? KeyPathEnd : T[K];
};

/**
 * Type of the proxy passed to typed callbacks: two levels (`column` or `alias.column`),
 * with arrays unwrapped (`user.images.url` for `images: ImageEntity[]`) and optional
 * properties made required.
 */
export type DeepUnwrapArray<T> = {
	[K in keyof T]-?: ProxyPropertyType<T[K]> extends object
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