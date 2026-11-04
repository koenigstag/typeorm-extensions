import { ObjectLiteral } from 'typeorm';
import { stringToSQLIdentifier } from './sql.utils';
import { DeepUnwrapArray, KeyProxyCallback } from '../types/modules/proxy-callback.types';

export class KeyHolder {
  constructor(private _keys: string[] = []) {
    this._keys = [..._keys];
  }

  toSql(length: number = 2, useQuotes?: boolean) {
    const string = this.toString(length);
    const sql = useQuotes ? stringToSQLIdentifier(string) : string;

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

/** Typed keys are `column` or `alias.column`: a deeper path can't be mapped to a query alias. */
export const MAX_KEY_DEPTH = 2;

const assertKeyDepth = (keyHolder: KeyHolder): KeyHolder => {
	const keys = keyHolder.getKeys();

	if (keys.length > MAX_KEY_DEPTH) {
		throw new TypeError(
			`Typed key "${keys.join('.')}" is ${keys.length} levels deep, but typed methods support only ` +
				`"column" or "alias.column". Join the nested relation and address it by its alias ` +
				`with an alias-keyed type, e.g. type Joins = { someAlias: SomeEntity }; (j) => j.someAlias.column`
		);
	}

	return keyHolder;
};

export const getKeyHolder = <Type extends ObjectLiteral>(
	callback: KeyProxyCallback<Type> | KeyHolder
): KeyHolder | Array<KeyHolder> => {
	if (typeof callback !== 'function') {
		if (callback instanceof KeyHolder) {
			return assertKeyDepth(callback);
		}
	}

	const keyHolder = callback(KeyProxy.create<DeepUnwrapArray<Type>>()) as KeyHolder | Array<KeyHolder>;

	// fail loudly instead of silently dropping levels beyond `alias.column`
	return Array.isArray(keyHolder) ? keyHolder.map(assertKeyDepth) : assertKeyDepth(keyHolder);
};

export const getKey = <Type extends ObjectLiteral>(callback: KeyProxyCallback<Type> | KeyHolder | string): string => {
	if (typeof callback === 'string') return callback;

	const keyHolder = getKeyHolder<Type>(callback);

	return keyHolder.toString();
};

/**
 * Alias to prefix a single-level key with: a string, or a function called only when it is needed,
 * e.g. `() => query.alias`, which throws while the query has no main alias (before `from()`).
 */
export type KeyPrefix = string | (() => string | undefined);

/**
 * SQL key of a typed callback: `(u) => u.id` → `prefix.id`, `(u) => u.images.url` → `images.url`
 * (an `alias.column` path keeps its own alias). Strings are returned as is.
 */
export const getSqlKeyFromProxyCallback = <Type extends ObjectLiteral>(
	callback: KeyProxyCallback<Type> | KeyHolder | string,
	addPrefix?: KeyPrefix,
	useQuotes?: boolean
): string | string[] => {
	if (typeof callback === 'string') return callback;

	const keyHolder = getKeyHolder<Type>(callback);

	if (Array.isArray(keyHolder)) {
		return keyHolder.map((holder) => getSqlKeyFromProxyCallback<Type>(holder, addPrefix, useQuotes) as string);
	}

	// if select is like this: (proxy) => proxy.relation.column
	if (keyHolder.getKeys().length > 1) {
		// return unchanged
		return keyHolder.toSql(undefined, useQuotes);
	}

	// else if select is one layer depth like this: (proxy) => proxy.column
	// then add alias before the key; resolve the alias only now, a path above doesn't need it
	const prefix = typeof addPrefix === 'function' ? addPrefix() : addPrefix;

	if (typeof prefix === 'string' && prefix.length >= 1) {
		// a new holder: a KeyHolder passed in by the caller must stay as it was
		return new KeyHolder([prefix, ...keyHolder.getKeys()]).toSql(undefined, useQuotes);
	}

	return keyHolder.toSql(undefined, useQuotes);
};

// example of typed select
// const key = getKey<UserEntity>((proxy) => proxy.sessions);
// console.log(key); // "sessions"
