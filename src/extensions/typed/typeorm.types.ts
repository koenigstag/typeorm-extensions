/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseEntity, ObjectLiteral } from 'typeorm';

export type SimpleColumnType = string | number | boolean | Date | null;

export type ColumnValueType = SimpleColumnType | undefined | object | ObjectLiteral | ':value';

export type RelationColumnsType<ColumnType, Key> = ColumnType extends SimpleColumnType | ((...args: any[]) => any)
	? never
	: ColumnType extends BaseEntity | BaseEntity[] | ObjectLiteral | ObjectLiteral[]
	? Key
	: never;
export type NonRelationColumnsType<ColumnType, Key> = ColumnType extends SimpleColumnType ? Key : never;

export type RelationPropertyNames<Type> = {
	[Key in keyof Type]: RelationColumnsType<Type[Key], Key>;
}[keyof Type] &
	string;
export type NonRelationPropertyNames<Type> = {
	[Key in keyof Type]: NonRelationColumnsType<Type[Key], Key>;
}[keyof Type] &
	string;

export type EntityOnlyWithRelations<Entity extends ObjectLiteral> = {
	[Key in RelationPropertyNames<Entity>]: Entity[Key];
};

export type EntityWithoutRelations<Entity extends ObjectLiteral> = {
	[Key in NonRelationPropertyNames<Entity>]: Entity[Key];
};
