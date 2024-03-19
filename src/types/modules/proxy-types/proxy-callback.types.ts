import { ObjectLiteral } from "typeorm";
import { ColumnValueType } from "../column.types";
import { EntityOnlyWithRelations, EntityWithoutRelations } from "../relations.types";

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: T) => ColumnValueType | Array<ColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityOnlyWithRelations<T>
) => ColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<T>
) => ColumnValueType;