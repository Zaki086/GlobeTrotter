import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Creates the test database (if absent) and brings it up to the latest
 * migration. Runs once for the whole suite.
 */
export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const baseUrl =
    process.env.DATABASE_URL ?? 'postgresql://globetrotter:globetrotter@localhost:5432/globetrotter';
  const testUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/globetrotter_test$2');
  const adminUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');

  const { Client } = require('pg') as typeof import('pg');

  // `CREATE DATABASE` cannot run inside a transaction or via Prisma, so it
  // goes through a raw connection to the maintenance database.
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    'globetrotter_test',
  ]);
  if (exists.rowCount === 0) {
    await client.query('CREATE DATABASE globetrotter_test');
  }
  await client.end();

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'ignore',
  });
}
