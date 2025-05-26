import { databaseDriver, databaseName } from "./constants/database";

export default async function globalSetup() {
  console.log('\n⚙️  Global setup: initializing test environment...');

  console.log('Database driver:', databaseDriver);
  console.log('Database name:', databaseName);

  console.log(`📀 Created database: ${databaseName}`);
}