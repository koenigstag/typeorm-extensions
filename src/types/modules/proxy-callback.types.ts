import { ObjectLiteral } from "typeorm";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "./relations.types";
import { ColumnValueType } from "./column.types";
import { UnwrapArray } from "../util-types";

export type ProxyColumnValueType = ColumnValueType | ':value';

export type DeepUnwrapArray<T> = {
	[K in keyof T]-?: NonNullable<T[K]> extends (infer U)[]
		? DeepUnwrapArray<U>
		: NonNullable<T[K]> extends object
			? DeepUnwrapArray<NonNullable<T[K]>>
			: T[K];
};

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: DeepUnwrapArray<T>) => ProxyColumnValueType | Array<ProxyColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: DeepUnwrapArray<EntityOnlyWithRelations<T>>
) => ProxyColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<UnwrapArray<T>>
) => ProxyColumnValueType;