import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { KeyHolder } from '../../../utils/proxy-key.utils';
import { getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { getDriverType } from '../../../utils/sql.utils';
import type { TypedOrderByOptions } from '../../../types/extensions/typed-order-by.types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity extends ObjectLiteral> {
		/**
		 * Sets ORDER BY condition in the query builder.
		 * If you had previously ORDER BY expression defined,
		 * calling this function will override previously set ORDER BY conditions.
		 */
		orderByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST',
			options?: TypedOrderByOptions
		): SelectQueryBuilder<Entity>;
		/**
		 * Adds ORDER BY condition in the query builder.
		 */
		addOrderByTyped<Type extends ObjectLiteral = TypedRoot<Entity>>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST',
			options?: TypedOrderByOptions
		): SelectQueryBuilder<Entity>;
	}
}

// patching and implementation

SelectQueryBuilder.prototype.orderByTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = TypedRoot<Entity>
>(
	this: SelectQueryBuilder<Entity>,
	selection?: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
	order?: 'ASC' | 'DESC',
	nulls?: 'NULLS FIRST' | 'NULLS LAST',
	options?: TypedOrderByOptions
): SelectQueryBuilder<Entity> {
	if (selection instanceof KeyHolder) {
		return this.orderBy(selection.toSql(undefined, options?.useQuotes, getDriverType(this)), order, nulls);
	}

	if (typeof selection === 'function') {
		const key = getTypedSelectionKey<Type>(this, selection, options?.useQuotes) as string;

		return this.orderBy(key, order, nulls);
	}

	return this;
};

SelectQueryBuilder.prototype.addOrderByTyped = function <
	Entity extends ObjectLiteral,
	Type extends ObjectLiteral = TypedRoot<Entity>
>(
	this: SelectQueryBuilder<Entity>,
	selection?: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
	order?: 'ASC' | 'DESC',
	nulls?: 'NULLS FIRST' | 'NULLS LAST',
	options?: TypedOrderByOptions
): SelectQueryBuilder<Entity> {
	if (selection instanceof KeyHolder) {
		return this.addOrderBy(selection.toSql(undefined, options?.useQuotes, getDriverType(this)), order, nulls);
	}

	if (typeof selection === 'function') {
		const key = getTypedSelectionKey<Type>(this, selection, options?.useQuotes) as string;

		return this.addOrderBy(key, order, nulls);
	}

	return this;
};
