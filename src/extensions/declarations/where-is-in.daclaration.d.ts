import type { ObjectLiteral } from "typeorm";
import type { ArgsType } from "../../types/util-types";

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
