import { ObjectLiteral } from "typeorm";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "./relations.types";
import { ColumnValueType } from "./column.types";

export type ProxyColumnValueType = ColumnValueType | ':value';

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: T) => ProxyColumnValueType | Array<ProxyColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityOnlyWithRelations<T>
) => ProxyColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<T>
) => ProxyColumnValueType;