import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { findTypedCalculatedProperty, getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { getKeyHolder } from '../../../utils/proxy-key.utils';
import { selectCalculatedForOrder } from '../../../utils/calculated-column.utils';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets the distinct on clause for Postgres. A `@CalculatedColumn` selected with `addSelectCalculated`
     * goes in under the alias `orderByCalculated` orders it by, as DISTINCT ON has to match the leading ORDER BY.
     */
    distinctOnTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
      this: SelectQueryBuilder<Entity>,
      ...distinctOn: Array<KeyProxyCallback<Type>>
    ): this;
    /**
     * Sets the distinct on clause for Postgres. A `@CalculatedColumn` selected with `addSelectCalculated`
     * goes in under the alias `orderByCalculated` orders it by, as DISTINCT ON has to match the leading ORDER BY.
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
		const keys = distinctOn.flatMap((callback) =>
			[getKeyHolder<Type>(callback)].flat().map((keyHolder) => {
				const calculated = findTypedCalculatedProperty(this, keyHolder);

				return calculated
					? selectCalculatedForOrder(this, calculated.propertyPath, calculated.aliasName, 'distinctOnTyped')
					: getTypedSelectionKey<Type>(this, keyHolder, undefined, 'distinctOnTyped');
			})
		);

		return this.distinctOn(keys.flat());
	}

	return this;
};
