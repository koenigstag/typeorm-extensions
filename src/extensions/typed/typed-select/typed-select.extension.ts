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
      selectionAliasName?: string,
      useQuotes?: boolean
    ): SelectQueryBuilder<Entity>;
    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    selectTyped(
      this: SelectQueryBuilder<Entity>,
      selection: string | KeyHolder,
      selectionAliasName?: string,
      useQuotes?: boolean
    ): SelectQueryBuilder<Entity>;
    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    selectTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: string[] | KeyHolder[] | Array<KeyProxyCallback<Type>>,
      useQuotes?: boolean
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new selection to the SELECT query.
     */
    addSelectTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: KeyProxyCallback<Type>,
      selectionAliasName?: string,
      useQuotes?: boolean
    ): SelectQueryBuilder<Entity>;
    /**
     * Adds new selection to the SELECT query.
     */
    addSelectTyped(
      this: SelectQueryBuilder<Entity>,
      selection: string | KeyHolder,
      selectionAliasName?: string,
      useQuotes?: boolean
    ): SelectQueryBuilder<Entity>;
    /**
     * Adds new selection to the SELECT query.
     */
    addSelectTyped<Type extends ObjectLiteral = Entity>(
      this: SelectQueryBuilder<Entity>,
      selection: string[] | KeyHolder[] | Array<KeyProxyCallback<Type>>,
      useQuotes?: boolean
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
      selectionAliasName?: string | boolean,
      useQuotes?: boolean
    ) {
      return attachSelectMethod<Entity, Type>(
        this,
        'select',
        selection,
        typeof selectionAliasName === 'string' ? selectionAliasName : undefined,
        typeof selectionAliasName === 'boolean'
          ? selectionAliasName
          : useQuotes
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
      selectionAliasName?: string | boolean,
      useQuotes?: boolean
    ) {
      return attachSelectMethod<Entity, Type>(
        this,
        'addSelect',
        selection,
        typeof selectionAliasName === 'string' ? selectionAliasName : undefined,
        typeof selectionAliasName === 'boolean'
          ? selectionAliasName
          : useQuotes
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
  selectionAliasName?: string,
  useQuotes?: boolean
): SelectQueryBuilder<Entity> => {
  if (selection instanceof KeyHolder) {
    return query[method](
      selection.toSql(undefined, useQuotes),
      selectionAliasName
    );
  }

  if (Array.isArray(selection)) {
    const arrayOfKeys = selection.map(
      (select) =>
        getSqlKeyFromProxyCallback<Type>(
          select,
          query.alias,
          useQuotes
        ) as string
    );

    return query[method](arrayOfKeys);
  } else if (typeof selection === 'function') {
    const keyArrayOrSingleKey = getSqlKeyFromProxyCallback<Type>(
      selection,
      query.alias,
      useQuotes
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
