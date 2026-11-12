import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      ...distinctOn: Array<KeyProxyCallback<Type>>
    ): this;
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      distinctOn: KeyProxyCallback<Type>
    ): this;
  }
}

// patching and implementation

SelectQueryBuilder.prototype.distinctOnTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = TypedRoot<Entity>
>(
	this: SelectQueryBuilder<Entity>,
	...distinctOn: Array<KeyProxyCallback<Type>>
): SelectQueryBuilder<Entity> {
	if (Array.isArray(distinctOn) && distinctOn.length) {
		const keys = distinctOn.map((callback) => getTypedSelectionKey<Type>(this, callback, undefined, 'distinctOnTyped')).flat();

		return this.distinctOn(keys as string[]);
	}

	return this;
};
