import { ObjectLiteral } from 'typeorm';
import { stringToSQLIdentifier } from './sql.utils';
import { KeyProxyCallback } from '../types/modules/proxy-callback.types';

export class KeyHolder {
  constructor(private _keys: string[] = []) {
    this._keys = [..._keys];
  }

  toSql(length: number = 2, useDoubleQuotes?: boolean) {
    const string = this.toString(length);
    const sql = useDoubleQuotes ? stringToSQLIdentifier(string) : string;

    return sql;
  }

  toString(length = 2) {
    const keys = this._keys.slice(0, length);
    const string = keys.join('.');

    return string;
  }

  valueOf() {
    return this.toString();
  }

  [Symbol.toPrimitive]() {
    return this.toString();
  }

  getKeys() {
    return this._keys.slice();
  }

  push(key: string | symbol) {
    if (
      typeof key !== 'symbol' &&
      !Object.getOwnPropertyNames(this).includes(key) && // check of getOwnPropertyNames(this) is questionable
      !Object.getOwnPropertyNames(KeyHolder.prototype).includes(key)
    ) {
      this._keys.push(key);
    }

    return this;
  }

  unshift(key: string | symbol) {
    if (
      typeof key !== 'symbol' &&
      !Object.getOwnPropertyNames(this).includes(key) && // check of getOwnPropertyNames(this) is questionable
      !Object.getOwnPropertyNames(KeyHolder.prototype).includes(key)
    ) {
      this._keys.unshift(key);
    }

    return this;
  }
}

export class TypedProxy {
  public static defaultHandler = {};

  public static create<T extends ObjectLiteral>(
    obj: object,
    handler = TypedProxy.defaultHandler
  ) {
    return new Proxy(obj, handler) as T;
  }
}

export class KeyProxy {
  public static defaultHandler: ProxyHandler<KeyHolder> = {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);

      if (value) {
        return value;
      }

      // for each key create new independent layer of KeyProxy
      const newKeyHolder = new KeyHolder(target.getKeys());
      const newLayer = TypedProxy.create<ObjectLiteral>(
        newKeyHolder.push(key),
        KeyProxy.defaultHandler
      );

      return newLayer;
    },
  };

  public static create<T extends ObjectLiteral>() {
    return TypedProxy.create<T>(new KeyHolder(), KeyProxy.defaultHandler);
  }
}

export const getKeyHolder = <Type extends ObjectLiteral>(
	callback: KeyProxyCallback<Type> | KeyHolder
): KeyHolder | Array<KeyHolder> => {
	if (typeof callback !== 'function') {
		if (callback instanceof KeyHolder) {
			return callback;
		}
	}

	const keyHolder = callback(KeyProxy.create<Type>()) as KeyHolder;

	return keyHolder;
};

export const getKey = <Type extends ObjectLiteral>(callback: KeyProxyCallback<Type> | KeyHolder | string): string => {
	if (typeof callback === 'string') return callback;

	const keyHolder = getKeyHolder<Type>(callback);

	return keyHolder.toString();
};

export const getSqlKeyFromProxyCallback = <Type extends ObjectLiteral>(
	callback: KeyProxyCallback<Type> | KeyHolder | string,
	addPrefix?: string,
	useDoubleQuotes?: boolean
): string | string[] => {
	if (typeof callback === 'string') return callback;

	const keyHolder = getKeyHolder<Type>(callback);

	if (Array.isArray(keyHolder)) {
		return keyHolder.map((holder) => getSqlKeyFromProxyCallback<Type>(holder, addPrefix) as string);
	}

	// if select is like this: (proxy) => proxy.relation.column
	if (keyHolder.getKeys().length > 1) {
		// return unchanged
		return keyHolder.toSql(undefined, useDoubleQuotes);
	}

	// else if select is one layer depth like this: (proxy) => proxy.column
	// then add alias before the key
	if (typeof addPrefix === 'string' && addPrefix.length >= 1) {
		keyHolder.unshift(addPrefix);
	}

	return keyHolder.toSql(undefined, useDoubleQuotes);
};

// example of typed select
// const key = getSqlKey<UserEntity>((proxy) => proxy.sessions);
// console.log(key);
