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
import {
  createUniqueParameterName,
  stringToSQLIdentifier,
} from '../utils/sql.utils';

// declarations

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType): this;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType): this;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType): this;
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType): SelectQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType): UpdateQueryBuilder<Entity>;
  }
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Sets WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     * The array is bound as a single parameter instead of one parameter per value.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereIsAny(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Adds new AND WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    andWhereIsAny(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;

    /**
     * Adds new OR WHERE `field = ANY(:array)` condition in the query builder (PostgreSQL).
     */
    orWhereIsAny(field: string, array?: ArgsType): DeleteQueryBuilder<Entity>;
  }
}

// patching

const createWhereIsAnyMethod = (method: WhereMethods) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    field: string,
    array?: ArgsType
  ): SelectQueryBuilder<Entity> {
    return attachWhereIsAny<SelectQueryBuilder<Entity>>(
      this,
      method,
      field,
      array
    );
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereIsAny: createWhereIsAnyMethod('where'),
    andWhereIsAny: createWhereIsAnyMethod('andWhere'),
    orWhereIsAny: createWhereIsAnyMethod('orWhere'),
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

function attachWhereIsAny<QB extends WhereExpressionBuilder>(
  builder: QB,
  method: WhereMethods,
  field: string,
  array?: ArgsType
): QB {
  if (!method || typeof field !== 'string') {
    return builder;
  }

  if (!array?.length) {
    // `= ANY(empty array)` matches nothing; don't bind an empty array, same as IN
    return builder[method]('FALSE');
  }

  const paramName = createUniqueParameterName(method);

  // "table"."column" = ANY(:param), where :param is the whole array
  return builder[method](
    `${stringToSQLIdentifier(field)} = ANY(:${paramName})`,
    { [paramName]: array }
  );
}
