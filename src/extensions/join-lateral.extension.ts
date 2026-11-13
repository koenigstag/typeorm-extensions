import { ObjectLiteral, QueryRunner, SelectQueryBuilder } from 'typeorm';
import type { LateralSubQuery } from '../types/extensions/join-lateral.types';
import { toSubQuerySql } from '../utils/parameter.utils';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

export interface JoinLateralMethods {
  /**
   * `LEFT JOIN LATERAL (subQuery) "alias" ON condition`: the subquery runs for each row and can use
   * the columns of the tables joined before it, e.g. the latest ticket of each user. Rows without a
   * match stay, with `NULL` columns. The condition defaults to `TRUE`.
   *
   * PostgreSQL, CockroachDB, MySQL 8.0.14+ and Oracle have LATERAL; SQLite, SQL Server and MariaDB don't.
   * The subquery's columns are raw: select them with `addSelect('"alias"."column"', 'name')`.
   */
  leftJoinLateral<SubEntity extends ObjectLiteral = ObjectLiteral>(
    subQuery: LateralSubQuery<SubEntity>,
    alias: string,
    condition?: string,
    parameters?: ObjectLiteral
  ): this;

  /** `INNER JOIN LATERAL`: as `leftJoinLateral`, but rows without a match are dropped. */
  innerJoinLateral<SubEntity extends ObjectLiteral = ObjectLiteral>(
    subQuery: LateralSubQuery<SubEntity>,
    alias: string,
    condition?: string,
    parameters?: ObjectLiteral
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends JoinLateralMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    leftJoinLateral<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      subQuery: LateralSubQuery<SubEntity>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity> {
      return joinLateral(this, 'leftJoin', subQuery, alias, condition, parameters);
    },
    innerJoinLateral<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      subQuery: LateralSubQuery<SubEntity>,
      alias: string,
      condition?: string,
      parameters?: ObjectLiteral
    ): SelectQueryBuilder<Entity> {
      return joinLateral(this, 'innerJoin', subQuery, alias, condition, parameters);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

type LateralSql = { sql: string; parameters: ObjectLiteral };

function joinLateral<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  method: 'leftJoin' | 'innerJoin',
  subQuery: LateralSubQuery<SubEntity>,
  alias: string,
  condition = 'TRUE',
  parameters?: ObjectLiteral
): SelectQueryBuilder<Entity> {
  const lateral = toLateralSql(builder, subQuery);

  // TypeORM puts the getQuery() of a join's subquery factory into the SQL as it is, and adds its
  // getParameters(): handing it the LATERAL keyword with the subquery is its own subquery-join path
  const factory = () =>
    ({
      getQuery: () => `LATERAL ${lateral.sql}`,
      getParameters: () => lateral.parameters,
    }) as unknown as SelectQueryBuilder<ObjectLiteral>;

  return builder[method](factory, alias, condition, parameters);
}

function toLateralSql<Entity extends ObjectLiteral, SubEntity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  subQuery: LateralSubQuery<SubEntity>
): LateralSql {
  if (typeof subQuery === 'string') {
    // raw SQL: its placeholders are the query's own parameters, set with `parameters` or setParameter
    return { sql: `(${subQuery})`, parameters: {} };
  }

  const subBuilder =
    typeof subQuery === 'function' ? subQuery(detachedSubQuery(builder)) : subQuery;

  const [sql, parameters] = toSubQuerySql(subBuilder);

  return { sql: `(${sql})`, parameters };
}

/**
 * A subquery builder for a factory, as TypeORM's `subQuery()` but without a parent: TypeORM's would
 * set the factory's parameters on the outer query under their own names, before they can be renamed.
 */
function detachedSubQuery<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>
): SelectQueryBuilder<ObjectLiteral> {
  const queryRunner = (builder as unknown as { queryRunner?: QueryRunner }).queryRunner;
  const subQuery = builder.connection.createQueryBuilder(queryRunner);

  subQuery.expressionMap.subQuery = true;

  return subQuery;
}
