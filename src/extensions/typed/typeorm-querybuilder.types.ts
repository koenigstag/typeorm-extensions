/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectLiteral } from 'typeorm';
import { ColumnValueType, EntityOnlyWithRelations, EntityWithoutRelations } from './typeorm.types';

export class KeyHolder {
	constructor(public keys: string[] = []) {
		this.keys = [...keys];
	}

	toSql(length: number = 2, addDobleQuotes = true) {
		const string = this.toString(length);
		const sql = addDobleQuotes ? `"${string.replace(/\./g, '"."')}"` : string;

		return sql;
	}

	toString(length = 2) {
		const keys = this.keys.slice(0, length);
		const string = keys.join('.');

		return string;
	}

	valueOf() {
		return this.toString();
	}

	[Symbol.toPrimitive]() {
		return this.toString();
	}

	add(key: string | symbol) {
		if (
			typeof key !== 'symbol' &&
			!Object.getOwnPropertyNames(this).includes(key) && // check of getOwnPropertyNames(this) is questionable
			!Object.getOwnPropertyNames(KeyHolder.prototype).includes(key)
		) {
			this.keys.push(key);
		}

		return this;
	}
}

export class TypedProxy {
	public static defaultHandler = {};

	public static create<T extends ObjectLiteral>(obj: object, handler = TypedProxy.defaultHandler) {
		return new Proxy(obj, handler) as T;
	}
}

export class KeyProxy {
	public static defaultHandler: ProxyHandler<KeyHolder> = {
		get(target, key, receiver) {
			// for each key create new independent layer of KeyProxy
			const newKeyHolder = new KeyHolder(target.keys).add(key);
			const newLayer = TypedProxy.create<ObjectLiteral>(newKeyHolder, KeyProxy.defaultHandler);

			return Reflect.get(target, key, receiver) ?? newLayer;
		},
	};

	public static create<T extends ObjectLiteral>() {
		return TypedProxy.create<T>(new KeyHolder(), KeyProxy.defaultHandler);
	}
}

export type KeyProxyCallback<T extends ObjectLiteral> = (proxy: T) => ColumnValueType | Array<ColumnValueType>;
export type RelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityOnlyWithRelations<T>
) => ColumnValueType;
export type NonRelationalKeyProxyCallback<T extends ObjectLiteral> = (
	proxy: EntityWithoutRelations<T>
) => ColumnValueType;
