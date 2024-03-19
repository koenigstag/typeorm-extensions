import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ColumnValueType } from '../typeorm.types';
import { getSqlKey } from '../../../utils/proxy-key.utils';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity> {
		/**
		 * Sets the distinct on clause for Postgres.
		 */
		distinctOnTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			...distinctOn: Array<(proxy: Type) => ColumnValueType>
		): SelectQueryBuilder<Entity>;
		/**
		 * Sets the distinct on clause for Postgres.
		 */
		distinctOnTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			distinctOn: (proxy: Type) => Array<ColumnValueType>
		): SelectQueryBuilder<Entity>;
	}
}

SelectQueryBuilder.prototype.distinctOnTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = Entity
>(
	this: SelectQueryBuilder<Entity>,
	...distinctOn: Array<(proxy: Type) => ColumnValueType | Array<ColumnValueType>>
): SelectQueryBuilder<Entity> {
	if (Array.isArray(distinctOn) && distinctOn.length) {
		const keys = distinctOn.map((callback) => getSqlKey<Type>(callback, this.alias)).flat(3);

		return this.distinctOn(keys as string[]);
	}

	return this;
};
