export const sqliteDrivers = [
  'better-sqlite3',
  'sqlite3',
] as const;

export const postgresLikeDrivers = [
  'postgres',
  'aurora-postgres',
  'cockroachdb',
] as const;

export const databaseDriver =
  (process.env.DATABASE_DRIVER as any) || ('better-sqlite3' as const);
export const databaseName = process.env.DATABASE_NAME || (':memory:' as const);

export const databaseHost = process.env.DATABASE_HOST;

export const databasePort = process.env.DATABASE_PORT
  ? parseInt(process.env.DATABASE_PORT, 10)
  : undefined;

export const databaseUsername = process.env.DATABASE_USER;

export const databasePassword = process.env.DATABASE_PASSWORD;

export const dropSchema = process.env.DROP_SCHEMA
  ? process.env.DROP_SCHEMA === 'true'
  : true;
