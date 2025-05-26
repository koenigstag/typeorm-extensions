import { databaseDriver } from './database';

export const dateColumn =
  databaseDriver === 'better-sqlite3' || databaseDriver === 'sqlite'
    ? ('datetime' as const)
    : ('timestamp' as const);
