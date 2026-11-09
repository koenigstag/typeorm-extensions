// The part of the playground that runs queries: TypeORM's browser build, typeorm-extensions
// (compiled from this repository's src), and PostgreSQL in WebAssembly (PGlite).
import 'reflect-metadata';
import * as typeorm from 'typeorm';
import {
  DataSource,
  DeleteQueryBuilder,
  InsertQueryBuilder,
  Logger,
  SelectQueryBuilder,
  UpdateQueryBuilder,
} from 'typeorm';
import { PGliteDriver } from 'typeorm-pglite';
import * as extensions from '../../../src/index';
import * as helpers from '../../../src/helpers';
import * as models from './models';

export type ExecutedQuery = {
  sql: string;
  parameters?: unknown[];
  error?: string;
};

export type RunResult = {
  queries: ExecutedQuery[];
  result?: unknown;
  error?: string;
  durationMs: number;
};

class CaptureLogger implements Logger {
  queries: ExecutedQuery[] = [];
  enabled = false;

  logQuery(query: string, parameters?: unknown[]) {
    if (this.enabled) {
      this.queries.push({ sql: query, parameters });
    }
  }

  logQueryError(error: string | Error, query: string, parameters?: unknown[]) {
    if (this.enabled) {
      this.queries.push({
        sql: query,
        parameters,
        error: typeof error === 'string' ? error : error.message,
      });
    }
  }

  logQuerySlow() {}
  logSchemaBuild() {}
  logMigration() {}
  log() {}
}

const logger = new CaptureLogger();

/**
 * A gzipped asset next to the bundle, unzipped. The files are gzipped at build time because the
 * hosting may not compress .wasm / .data; a server that does would send them unzipped already.
 */
async function fetchGzipped(file: string): Promise<ArrayBuffer> {
  const response = await fetch(new URL(`./${file}.gz`, import.meta.url));

  if (!response.ok) {
    throw new Error(`Could not load ${file}: HTTP ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const view = new Uint8Array(bytes);

  if (view[0] !== 0x1f || view[1] !== 0x8b) {
    return bytes;
  }

  const unzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(unzipped).arrayBuffer();
}

async function loadPGliteAssets() {
  const [pgliteWasm, initdbWasm, fsBundle] = await Promise.all(
    ['pglite.wasm', 'initdb.wasm', 'pglite.data'].map(fetchGzipped),
  );

  return {
    pgliteWasmModule: await WebAssembly.compile(pgliteWasm),
    initdbWasmModule: await WebAssembly.compile(initdbWasm),
    fsBundle: new Blob([fsBundle]),
  };
}

let dataSourcePromise: Promise<DataSource> | undefined;

/** Starts PostgreSQL and creates the tables, once. */
export function getDataSource(): Promise<DataSource> {
  dataSourcePromise ??= (async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      driver: new PGliteDriver(await loadPGliteAssets()).driver,
      entities: models.entities,
      synchronize: true,
      logger,
    });

    await dataSource.initialize();
    await resetData(dataSource);

    return dataSource;
  })();

  return dataSourcePromise;
}

const SEED_SQL = `
TRUNCATE images, users, tickets, articles RESTART IDENTITY CASCADE;

INSERT INTO users ("firstName", "lastName", email, metadata, created_at) VALUES
  ('Ann',   'Lee',   'ann@example.com',   '{"role": "admin", "settings": {"theme": "dark", "language": "en"}}',  '2024-01-05 09:30:00'),
  ('Bob',   'Stone', 'bob@example.com',   '{"role": "user", "settings": {"theme": "light", "language": "de"}}',  '2024-01-18 14:00:00'),
  ('Carol', 'King',  'carol@example.com', '{"role": "user", "settings": {"theme": "dark", "language": "en"}}',   '2024-01-31 18:45:00'),
  ('Dave',  'Moss',  'dave@example.com',  '{"role": "user", "settings": {"theme": "light", "language": "uk"}}',  '2024-02-01 08:15:00'),
  ('Eve',   'Park',  'eve@example.com',   '{"role": "admin", "settings": {"theme": "light", "language": "en"}}', '2024-02-14 12:00:00'),
  ('Frank', 'Ode',   'frank@example.com', NULL,                                                                  '2024-03-02 10:00:00');

INSERT INTO images (url, "userId") VALUES
  ('https://example.com/ann-1.png', 1),
  ('https://example.com/ann-2.png', 1),
  ('https://example.com/bob-1.png', 2),
  ('https://example.com/dave-1.png', 4);

INSERT INTO tickets (ticket_status, owner_id) VALUES
  ('open', 1), ('in_progress', 1), ('closed', 2), ('open', NULL), ('closed', NULL), ('open', 3);

INSERT INTO articles (title, tags, meta, published_at) VALUES
  ('Typed query builders',   '{typeorm,typescript}', '{"status": "published", "author": {"name": "Ann"}}', '2024-01-10 10:00:00'),
  ('Keyset pagination',      '{postgres,pagination}', '{"status": "published", "author": {"name": "Bob"}}', '2024-02-02 16:30:00'),
  ('JSONB in practice',      '{postgres,jsonb}',      '{"status": "draft"}',                                NULL),
  ('Arrays vs join tables',  '{postgres,sql}',        '{"status": "published", "author": {"name": "Ann"}}', '2024-03-01 09:00:00');
`;

async function resetData(dataSource: DataSource) {
  const enabled = logger.enabled;
  logger.enabled = false;

  try {
    for (const statement of SEED_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await dataSource.query(statement);
    }
  } finally {
    logger.enabled = enabled;
  }
}

/** Runs a query builder that wasn't executed by the code itself. */
async function execute(value: unknown): Promise<unknown> {
  if (value instanceof SelectQueryBuilder) {
    return value.getMany();
  }

  if (
    value instanceof InsertQueryBuilder ||
    value instanceof UpdateQueryBuilder ||
    value instanceof DeleteQueryBuilder
  ) {
    return value.execute();
  }

  return value;
}

/** Dates as the database shows them, no cycles, no class instances. */
function toPlain(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Date) {
    const pad = (n: number, size = 2) => String(n).padStart(size, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item, seen));
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item, seen)]));
}

/**
 * Runs the compiled (CommonJS) code of the editor: refills the tables, evaluates the code,
 * executes its default export (a query builder, a promise, or a function returning either),
 * and returns every SQL query it sent, with the result or the error.
 */
export async function run(compiledCode: string): Promise<RunResult> {
  const dataSource = await getDataSource();
  await resetData(dataSource);

  logger.queries = [];
  logger.enabled = true;
  const started = performance.now();

  const modules: Record<string, unknown> = {
    playground: { ...models, dataSource },
    typeorm,
    'typeorm-extensions': extensions,
    'typeorm-extensions/helpers': helpers,
  };

  const requireModule = (name: string) => {
    if (name in modules) {
      return modules[name];
    }

    throw new Error(`Cannot import "${name}" in the playground: use 'playground', 'typeorm' or 'typeorm-extensions'`);
  };

  try {
    const module = { exports: {} as Record<string, unknown> };
    new Function('require', 'module', 'exports', compiledCode)(requireModule, module, module.exports);

    let value = module.exports.default;

    if (value === undefined) {
      throw new Error('Nothing to run: export a query builder, e.g. `export default dataSource.getRepository(User).createQueryBuilder("user")`');
    }

    if (typeof value === 'function') {
      value = await (value as () => unknown)();
    }

    const result = await execute(await value);

    return { queries: logger.queries, result: toPlain(result), durationMs: performance.now() - started };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { queries: logger.queries, error: message, durationMs: performance.now() - started };
  } finally {
    logger.enabled = false;
  }
}
