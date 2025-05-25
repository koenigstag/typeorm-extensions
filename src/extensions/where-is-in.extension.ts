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

// declarations

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(field: string, array?: ArgsType): this;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(field: string, array?: ArgsType): this;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(field: string, array?: ArgsType): this;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(field: string, array?: ArgsType): this;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(field: string, array?: ArgsType): this;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(field: string, array?: ArgsType): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): SelectQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): UpdateQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): UpdateQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsIn(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE IN condition in the query builder.
     */
    andWhereIsIn(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE IN condition in the query builder.
     */
    orWhereIsIn(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Sets WHERE NOT IN condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsNotIn(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE NOT IN condition in the query builder.
     */
    andWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): DeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE NOT IN condition in the query builder.
     */

    orWhereIsNotIn(
      field: string,
      array?: ArgsType
    ): DeleteQueryBuilder<Entity>;
  }
}

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
