import type { ObjectLiteral } from "typeorm";
import type { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import type { KeyHolder } from '../../../utils/proxy-key.utils';

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity extends ObjectLiteral> {
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