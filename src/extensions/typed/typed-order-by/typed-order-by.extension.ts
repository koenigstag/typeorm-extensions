import '../../declarations/typed/typed-order-by.declaration';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getSqlKeyFromProxyCallback, KeyHolder } from '../../../utils/proxy-key.utils';

// patching and implementation

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
