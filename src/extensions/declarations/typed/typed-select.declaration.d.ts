import type { ObjectLiteral } from "typeorm";
import type { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import type { KeyHolder } from "../../../utils/proxy-key.utils";

declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity> {
		/**
		 * Creates SELECT query.
		 * Replaces all previous selections if they exist.
		 */
		selectTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: KeyProxyCallback<Type>,
			selectionAliasName?: string
		): SelectQueryBuilder<Entity>;
		/**
		 * Creates SELECT query and selects given data.
		 * Replaces all previous selections if they exist.
		 */
		selectTyped(
			this: SelectQueryBuilder<Entity>,
			selection: string | KeyHolder,
			selectionAliasName?: string
		): SelectQueryBuilder<Entity>;
		/**
		 * Creates SELECT query and selects given data.
		 * Replaces all previous selections if they exist.
		 */
		selectTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: string[] | KeyHolder[] | Array<KeyProxyCallback<Type>>
		): SelectQueryBuilder<Entity>;

		/**
		 * Adds new selection to the SELECT query.
		 */
		addSelectTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: KeyProxyCallback<Type>,
			selectionAliasName?: string
		): SelectQueryBuilder<Entity>;
		/**
		 * Adds new selection to the SELECT query.
		 */
		addSelectTyped(
			this: SelectQueryBuilder<Entity>,
			selection: string | KeyHolder,
			selectionAliasName?: string
		): SelectQueryBuilder<Entity>;
		/**
		 * Adds new selection to the SELECT query.
		 */
		addSelectTyped<Type extends ObjectLiteral = Entity>(
			this: SelectQueryBuilder<Entity>,
			selection: string[] | KeyHolder[] | Array<KeyProxyCallback<Type>>
		): SelectQueryBuilder<Entity>;
	}
}
