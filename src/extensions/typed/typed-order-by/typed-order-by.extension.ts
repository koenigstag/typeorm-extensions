import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { KeyHolder } from '../../../utils/proxy-key.utils';
import { getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
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
		orderByTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST',
			options?: TypedOrderByOptions
		): this;
		/**
		 * Adds ORDER BY condition in the query builder.
		 */
		addOrderByTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
			this: SelectQueryBuilder<Entity>,
			selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
			order?: 'ASC' | 'DESC',
			nulls?: 'NULLS FIRST' | 'NULLS LAST',
			options?: TypedOrderByOptions
		): this;
	}
}

// patching and implementation

const createOrderByTypedMethod = (method: 'orderBy' | 'addOrderBy') =>
	function <Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
		this: SelectQueryBuilder<Entity>,
		selection?: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType | KeyHolder,
		order?: 'ASC' | 'DESC',
		nulls?: 'NULLS FIRST' | 'NULLS LAST',
		options?: TypedOrderByOptions
	): SelectQueryBuilder<Entity> {
		if (selection instanceof KeyHolder || typeof selection === 'function') {
			const key = getTypedSelectionKey<Type>(this, selection, options?.useQuotes, `${method}Typed`) as string;

			return this[method](key, order, nulls);
		}

		return this;
	};

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
	prototype: {
		orderByTyped: createOrderByTypedMethod('orderBy'),
		addOrderByTyped: createOrderByTypedMethod('addOrderBy'),
	},
};

patchPrototype(SelectQueryBuilder, extension);
