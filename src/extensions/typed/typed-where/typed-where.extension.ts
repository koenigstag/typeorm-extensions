import '../../declarations/typed/typed-where.declaration';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getSqlKeyFromProxyCallback } from '../../../utils/proxy-key.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { WhereMethods } from '../../../types/extensions';
import { TypedWhereOptions } from '../../../types/extensions/typed-where.types';
import { attachWhere } from '../../../utils/where.utils';

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      operator: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'where',
        where,
        operator,
        parameters,
        options
      );
    },
    andWhereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      operator: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        where,
        operator,
        parameters,
        options
      );
    },
    orWhereTyped: function <
      Entity extends ObjectLiteral,
      Type extends ObjectLiteral = Entity
    >(
      this: SelectQueryBuilder<Entity>,
      where: (proxy: Type) => ProxyColumnValueType,
      operator: string,
      parameters?: ObjectLiteral,
      options?: TypedWhereOptions
    ): SelectQueryBuilder<Entity> {
      return attachTypedWhere<Type, SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        where,
        operator,
        parameters,
        options
      );
    },
  },
};

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});

// implementation

function attachTypedWhere<
  Type extends ObjectLiteral,
  QB extends WhereExpressionBuilder = WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  where: (proxy: Type) => ProxyColumnValueType,
  conditions: string,
  parameters?: ObjectLiteral,
  options?: TypedWhereOptions
): QB {
  const { useDoubleQuotes, addValue = true } = options || {};

  if (typeof where === 'function') {
    const alias = (builder as unknown as SelectQueryBuilder<Type>).alias;
    const key = getSqlKeyFromProxyCallback<Type>(where, alias, useDoubleQuotes);

    if (Array.isArray(key)) {
      for (const k of key) {
        builder = attachWhere<QB>(builder, method, k, conditions, parameters, {
          addValue,
        });
      }

      return builder;
    }

    return attachWhere<QB>(builder, method, key, conditions, parameters, {
      addValue,
    });
  }

  return builder;
}
