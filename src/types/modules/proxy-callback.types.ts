import { ObjectLiteral } from "typeorm";
import { ProxyColumnValueType } from "./typeorm.types";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "./relations.types";

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: T) => ProxyColumnValueType | Array<ProxyColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityOnlyWithRelations<T>
) => ProxyColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<T>
) => ProxyColumnValueType;