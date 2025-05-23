import './declarations/where-is-in.daclaration';
import {
  SelectQueryBuilder,
  WhereExpressionBuilder,
  ObjectLiteral,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { patchPrototype } from '../utils/prototype.utils';
import { ArgsType } from '../types/util-types';
import { WhereMethods } from '../types/extensions';
import { attachWhere } from '../utils/where.utils';

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType,
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'where',
        field,
        'IN',
        array,
      );
    },
    andWhereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType,
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        field,
        'IN',
        array,
      );
    },
    orWhereIsIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType,
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        field,
        'IN',
        array,
      );
    },
    whereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType,
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'where',
        field,
        'NOT IN',
        array,
      );
    },
    andWhereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'andWhere',
        field,
        'NOT IN',
        array,
      );
    },
    orWhereIsNotIn: function <
      Entity extends ObjectLiteral,
    >(
      this: SelectQueryBuilder<Entity>,
      field: string,
      array?: ArgsType,
    ): SelectQueryBuilder<Entity> {
      return attachWhereIsIn<SelectQueryBuilder<Entity>>(
        this,
        'orWhere',
        field,
        'NOT IN',
        array,
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

function attachWhereIsIn<
  QB extends WhereExpressionBuilder
>(
  builder: QB,
  method: WhereMethods,
  field: string,
  operator: 'IN' | 'NOT IN',
  array?: ArgsType
): QB {
  if (method && typeof field === 'string' && typeof operator === 'string') {
    if (!array?.length) {
      // if the array is empty, we can use a simple condition
      // IN (empty array) => FALSE
      // NOT IN (empty array) => TRUE
      return builder[method](operator === 'IN' ? 'FALSE' : 'TRUE');
    }

    return attachWhere(
      builder,
      method,
      field,
      operator,
      { value: array },
      {
        addValue: true,
      }
    );
  }

  return builder;
}
