import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getKeyHolder, KeyHolder } from '../../../utils/proxy-key.utils';
import { findTypedCalculatedProperty, getTypedSelectionKey } from '../../../utils/query-builder.utils';
import { selectCalculatedForOrder } from '../../../utils/calculated-column.utils';
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
		 * A `@CalculatedColumn` is ordered by its value, selected with `addSelectCalculated` first.
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
		 * A `@CalculatedColumn` is ordered by its value, selected with `addSelectCalculated` first.
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
			const methodName = `${method}Typed`;
			const keyHolder = getKeyHolder<Type>(selection);
			const calculated = keyHolder instanceof KeyHolder ? findTypedCalculatedProperty(this, keyHolder) : undefined;

			// a @CalculatedColumn is ordered by its value, which has to be selected with addSelectCalculated first
			const key = calculated
				? selectCalculatedForOrder(this, calculated.propertyPath, calculated.aliasName, methodName)
				: (getTypedSelectionKey<Type>(this, selection, options?.useQuotes, methodName) as string);

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
