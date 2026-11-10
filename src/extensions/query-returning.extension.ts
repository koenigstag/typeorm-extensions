import { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';
import type { QueryReturningResult } from '../types/extensions/query-returning.types';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

export interface QueryReturningMethods {
  /**
   * Runs a raw statement and resolves its rows and the row count it touched, in the same shape
   * whatever the statement: `{ records, affected }`.
   *
   * `query()` shapes its result by the command instead. On PostgreSQL an UPDATE or a DELETE resolves
   * to `[rows, rowCount]`, while a SELECT or an INSERT resolves to the rows, so `(await query(sql))[0]`
   * is the first row of an INSERT … RETURNING but the whole rows array of an UPDATE … RETURNING:
   * truthy, so a `if (!row) throw` check passes, and every field of it reads `undefined`.
   *
   * On an entity manager bound to a query runner (inside a transaction) the statement runs on that
   * runner, so it stays in the transaction; otherwise it gets a query runner of its own and releases it.
   */
  queryReturning<Row = ObjectLiteral>(
    query: string,
    parameters?: unknown[]
  ): Promise<QueryReturningResult<Row>>;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/entity-manager/EntityManager' {
  interface EntityManager extends QueryReturningMethods {}
}

declare module 'typeorm/repository/Repository' {
  interface Repository<Entity extends ObjectLiteral> extends QueryReturningMethods {}
}

declare module 'typeorm/data-source/DataSource' {
  interface DataSource extends QueryReturningMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

patchPrototype(EntityManager, {
  prototype: {
    queryReturning: function <Row>(
      this: EntityManager,
      query: string,
      parameters?: unknown[]
    ): Promise<QueryReturningResult<Row>> {
      return queryReturning<Row>(this, query, parameters);
    },
  },
});

patchPrototype(Repository, {
  prototype: {
    queryReturning: function <Row>(
      this: Repository<ObjectLiteral>,
      query: string,
      parameters?: unknown[]
    ): Promise<QueryReturningResult<Row>> {
      return queryReturning<Row>(this.manager, query, parameters);
    },
  },
});

patchPrototype(DataSource, {
  prototype: {
    queryReturning: function <Row>(
      this: DataSource,
      query: string,
      parameters?: unknown[]
    ): Promise<QueryReturningResult<Row>> {
      return queryReturning<Row>(this.manager, query, parameters);
    },
  },
});

// implementation

const WRITE_RETURNING = /^(?:INSERT|UPDATE|DELETE)\s[\s\S]*\bRETURNING\b/i;

async function queryReturning<Row>(
  manager: EntityManager,
  query: string,
  parameters?: unknown[]
): Promise<QueryReturningResult<Row>> {
  const boundQueryRunner = manager.queryRunner;
  // TypeORM 1.x names the manager's data source `dataSource`; 0.3 calls it `connection`
  const dataSource =
    (manager as EntityManager & { dataSource?: DataSource }).dataSource ?? manager.connection;
  const queryRunner = boundQueryRunner ?? dataSource.createQueryRunner();

  // TypeORM's runner of the sqlite3 driver runs a statement that starts with `INSERT ` / `UPDATE ` /
  // `DELETE ` without reading rows, which drops a RETURNING; after a line break it reads them
  const sql = dataSource.options.type === 'sqlite' && WRITE_RETURNING.test(query) ? `\n${query}` : query;

  try {
    const result = await queryRunner.query(sql, parameters, true);

    return { records: result.records ?? [], affected: result.affected ?? null };
  } finally {
    if (!boundQueryRunner) {
      await queryRunner.release();
    }
  }
}
