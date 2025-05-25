import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { KeyProxyCallback } from '../../../types/modules/proxy-callback.types';
import {
  getSqlKeyFromProxyCallback,
  KeyHolder,
} from '../../../utils/proxy-key.utils';
import { patchPrototype } from '../../../utils/prototype.utils';

// declarations

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

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    selectTyped<
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      selection?:
        | string
        | KeyHolder
        | KeyProxyCallback<Type>
        | string[]
        | KeyHolder[]
        | Array<KeyProxyCallback<Type>>,
      selectionAliasName?: string
    ) {
      return attachSelectMethod<Entity, Type>(
        this,
        'select',
        selection,
        selectionAliasName
      );
    },
    addSelectTyped<
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      selection?:
        | string
        | KeyHolder
        | KeyProxyCallback<Type>
        | string[]
        | KeyHolder[]
        | Array<KeyProxyCallback<Type>>,
      selectionAliasName?: string
    ) {
      return attachSelectMethod<Entity, Type>(
        this,
        'addSelect',
        selection,
        selectionAliasName
      );
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

const attachSelectMethod = <
  Entity extends ObjectLiteral,
  Type extends ObjectLiteral = Entity
>(
  query: SelectQueryBuilder<Entity>,
  method: 'select' | 'addSelect',
  selection?:
    | string
    | KeyHolder
    | KeyProxyCallback<Type>
    | string[]
    | KeyHolder[]
    | Array<KeyProxyCallback<Type>>,
  selectionAliasName?: string
): SelectQueryBuilder<Entity> => {
  if (selection instanceof KeyHolder) {
    return query[method](selection.toSql(), selectionAliasName);
  }

  if (Array.isArray(selection)) {
    const arrayOfKeys = selection.map(
      (select) =>
        getSqlKeyFromProxyCallback<Type>(select, query.alias) as string
    );

    return query[method](arrayOfKeys);
  } else if (typeof selection === 'function') {
    const keyArrayOrSingleKey = getSqlKeyFromProxyCallback<Type>(
      selection,
      query.alias
    );

    if (Array.isArray(keyArrayOrSingleKey)) {
      return query[method](keyArrayOrSingleKey);
    }

    return query[method](keyArrayOrSingleKey, selectionAliasName);
  } else if (typeof selection === 'string') {
    return query[method](selection, selectionAliasName);
  }

  return query;
};
