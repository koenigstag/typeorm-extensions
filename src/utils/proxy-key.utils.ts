import { ObjectLiteral } from 'typeorm';
import { stringToSQLIdentifier } from './sql.utils';
import { KeyProxyCallback } from '../types/modules/proxy-callback.types';

export class KeyHolder {
  constructor(public keys: string[] = []) {
    this.keys = [...keys];
  }

  toSql(length: number = 2, addDobleQuotes = true) {
    const string = this.toString(length);
    const sql = addDobleQuotes ? stringToSQLIdentifier(string) : string;

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
      const newKeyHolder = new KeyHolder(target.keys).add(key);
      const newLayer = TypedProxy.create<ObjectLiteral>(
        newKeyHolder,
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

export const getSqlKey = <Type extends ObjectLiteral>(
	callback: KeyProxyCallback<Type> | KeyHolder | string,
	addPrefix?: string,
	addDobleQuotes = true
): string | string[] => {
	if (typeof callback === 'string') return callback;

	const keyHolder = getKeyHolder<Type>(callback);

	if (Array.isArray(keyHolder)) {
		return keyHolder.map((holder) => getSqlKey<Type>(holder, addPrefix) as string);
	}

	// if select is like this: (proxy) => proxy.relation.column
	if (keyHolder.keys.length > 1) {
		// return unchanged
		return keyHolder.toSql(undefined, addDobleQuotes);
	}

	// else if select is one layer depth like this: (proxy) => proxy.column
	// then add alias before the key
	if (typeof addPrefix === 'string' && addPrefix.length >= 1) {
		keyHolder.keys.unshift(addPrefix);
	}

	return keyHolder.toSql(undefined, addDobleQuotes);
};

// example of typed select
// const key = getSqlKey<UserEntity>((proxy) => proxy.sessions);
// console.log(key);
