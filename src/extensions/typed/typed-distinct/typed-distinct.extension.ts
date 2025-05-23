import '../../declarations/typed/typed-distinct.declaration';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';

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
