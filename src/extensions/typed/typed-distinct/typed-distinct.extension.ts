import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity> {
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

SelectQueryBuilder.prototype.distinctOnTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = Entity
>(
	this: SelectQueryBuilder<Entity>,
	...distinctOn: Array<KeyProxyCallback<Type>>
): SelectQueryBuilder<Entity> {
	if (Array.isArray(distinctOn) && distinctOn.length) {
		const keys = distinctOn.map((callback) => getSqlKeyFromProxyCallback<Type>(callback, this.alias)).flat(3);

		return this.distinctOn(keys as string[]);
	}

	return this;
};
