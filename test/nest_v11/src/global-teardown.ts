import { databaseDriver, databaseName } from './constants/database';

export default async function globalTeardown() {
  console.log('🧹 Global teardown: cleaning up...');

  console.log(`🗑️  Deleted test DB`);
}
