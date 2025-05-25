import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      ...distinctOn: Array<KeyProxyCallback<Type>>
    ): SelectQueryBuilder<Entity>;
    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOnTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      distinctOn: KeyProxyCallback<Type>
    ): SelectQueryBuilder<Entity>;
  }
}

// patching and implementation

SelectQueryBuilder.prototype.distinctOnTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = Entity
>(
	this: SelectQueryBuilder<Entity>,
	...distinctOn: Array<KeyProxyCallback<Type>>
): SelectQueryBuilder<Entity> {
	if (Array.isArray(distinctOn) && distinctOn.length) {
		const keys = distinctOn.map((callback) => getSqlKeyFromProxyCallback<Type>(callback, this.alias)).flat();

		return this.distinctOn(keys as string[]);
	}

	return this;
};
