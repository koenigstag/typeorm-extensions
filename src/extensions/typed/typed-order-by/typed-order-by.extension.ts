import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ProxyColumnValueType } from '../../../types/modules/typeorm.types';
import { getSqlKeyFromProxyCallback, KeyHolder } from '../../../utils/proxy-key.utils';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity> {
		/**
		 * Sets ORDER BY condition in the query builder.
		 * If you had previously ORDER BY expression defined,
		 * calling this function will override previously set ORDER BY conditions.
		 */
		orderByTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: Type) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST'
		): SelectQueryBuilder<Entity>;
		/**
		 * Adds ORDER BY condition in the query builder.
		 */
		addOrderByTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: Type) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST'
		): SelectQueryBuilder<Entity>;
	}
}

SelectQueryBuilder.prototype.orderByTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = Entity
>(
	this: SelectQueryBuilder<Entity>,
	selection?: (proxy: Type) => ProxyColumnValueType | KeyHolder,
	order?: 'ASC' | 'DESC',
	nulls?: 'NULLS FIRST' | 'NULLS LAST'
): SelectQueryBuilder<Entity> {
	if (selection instanceof KeyHolder) {
		return this.orderBy(selection.toSql(), order, nulls);
	}

	if (typeof selection === 'function') {
		const key = getSqlKeyFromProxyCallback<Type>(selection, this.alias) as string;

		return this.orderBy(key, order, nulls);
	}

	return this;
};

SelectQueryBuilder.prototype.addOrderByTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = Entity
>(
	this: SelectQueryBuilder<Entity>,
	selection?: (proxy: Type) => ProxyColumnValueType | KeyHolder,
	order?: 'ASC' | 'DESC',
	nulls?: 'NULLS FIRST' | 'NULLS LAST'
): SelectQueryBuilder<Entity> {
	if (selection instanceof KeyHolder) {
		return this.addOrderBy(selection.toSql(), order, nulls);
	}

	if (typeof selection === 'function') {
		const key = getSqlKeyFromProxyCallback<Type>(selection, this.alias) as string;

		return this.addOrderBy(key, order, nulls);
	}

	return this;
};
